import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Space,
  Form,
  Card,
  message,
  Typography,
  Row,
  Col,
  Table,
  Tag,
  Popconfirm,
  Select,
  Switch,
  Divider,
} from "antd";
import {
  SaveOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
} from "@ant-design/icons";
import api from "../service/api";
import { canEdit, canDelete, canCreate } from "../service/auth";

const { TextArea } = Input;
const { Title, Text } = Typography;

const AddressManagement = () => {
  const [form] = Form.useForm();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
  });

  // Fetch addresses
  const fetchAddresses = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/address?page=${page}&limit=${limit}`);
      setAddresses(res.data.data || []);

      // Update pagination state
      setPagination(prev => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
      }));
    } catch (err) {
      console.error("Error fetching addresses", err);
      message.error("Error fetching addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  // Handle form submit
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const payload = {
        addressBill: values.addressBill.trim(),
        addressShip: values.addressShip.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
      };

      if (editingId) {
        // Update existing address
        await api.put(`/api/address/${editingId}`, payload);
        message.success("Address updated successfully");
      } else {
        // Create new address
        await api.post("/api/address", payload);
        message.success("Address created successfully");
      }

      setShowForm(false);
      setEditingId(null);
      form.resetFields();
      fetchAddresses(pagination.current, pagination.pageSize);
    } catch (err) {
      console.error("Error saving address", err);
      message.error("Error saving address");
    } finally {
      setLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (record) => {
    setEditingId(record.id);
    setShowForm(true);
    form.setFieldsValue({
      addressBill: record.addressBill,
      addressShip: record.addressShip,
      phone: record.phone,
      email: record.email,
    });
  };

  // Handle delete
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/address/${id}/hard`);
      message.success("Address deleted successfully");
      fetchAddresses(pagination.current, pagination.pageSize);
    } catch (err) {
      console.error("Error deleting address", err);
      message.error("Error deleting address");
    }
  };

  // Handle table change
  const handleTableChange = (pagination) => {
    fetchAddresses(pagination.current, pagination.pageSize);
  };

  // Table columns
  const columns = [
    {
      title: "Billing Address",
      dataIndex: "addressBill",
      key: "addressBill",
      render: (text) => (
        <div style={{ maxWidth: 200, wordWrap: 'break-word' }}>
          {text}
        </div>
      ),
    },
    {
      title: "Shipping Address",
      dataIndex: "addressShip",
      key: "addressShip",
      render: (text) => (
        <div style={{ maxWidth: 200, wordWrap: 'break-word' }}>
          {text}
        </div>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Created By",
      dataIndex: "createdBy",
      key: "createdBy",
      render: (createdBy) => createdBy || "-",
    },
    {
      title: "Updated By",
      dataIndex: "updatedBy",
      key: "updatedBy",
      render: (updatedBy) => updatedBy || "-",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          {canEdit() && (
            <Button

              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >

            </Button>
          )}
          {canDelete() && (
            <Popconfirm
              title="Are you sure you want to delete this address?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button danger icon={<DeleteOutlined />}>

              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Title level={2} className="mb-2">Address Management</Title>
          <Text type="secondary">Manage multiple billing and shipping addresses for Purchase Orders</Text>
        </div>
        {canCreate() && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              form.resetFields();
            }}
          >
            Add Address
          </Button>
        )}
      </div>

      {/* Address Form */}
      {showForm && (
        <Card title={editingId ? "Edit Address" : "Add New Address"}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="max-w-4xl"
          >
            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Form.Item
                  name="addressBill"
                  label="Billing Address"
                  rules={[
                    { required: true, message: "Billing address is required" },
                    { max: 255, message: "Billing address must be less than 255 characters" }
                  ]}
                >
                  <TextArea
                    rows={4}
                    placeholder="Enter billing address"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} lg={12}>
                <Form.Item
                  name="addressShip"
                  label="Shipping Address"
                  rules={[
                    { required: true, message: "Shipping address is required" },
                    { max: 255, message: "Shipping address must be less than 255 characters" }
                  ]}
                >
                  <TextArea
                    rows={4}
                    placeholder="Enter shipping address"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="phone"
                  label="Phone Number"

                  rules={[
                    { required: true, message: "Phone number is required" },
                    { pattern: /^\d{10, 11}$/, message: "Phone number must be exactly 10 digits" }
                  ]}
                >
                  <Input
                    placeholder="Enter 10-digit phone number"
                    maxLength={11}
                    onKeyPress={(e) => {
                      if (!/[0-9]/.test(e.key)) {
                        e.preventDefault(); 
                      }
                    }}
                    onPaste={(e) => {
                      const pasteData = e.clipboardData.getData("Text");
                      if (!/^\d+$/.test(pasteData)) {
                        e.preventDefault(); 
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="email"
                  label="Email Address"
                  rules={[
                    { required: true, message: "Email address is required" },
                    { type: "email", message: "Please enter a valid email address" },
                    { max: 255, message: "Email must be less than 255 characters" }
                  ]}
                >
                  <Input
                    placeholder="Enter email address"
                    type="email"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                >
                  {editingId ? "Update Address" : "Save Address"}
                </Button>
                <Button onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  form.resetFields();
                }}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* Addresses Table */}
      <Table
        columns={columns}
        dataSource={addresses}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} addresses`
        }}
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
      />

    </div>
  );
};

export default AddressManagement;