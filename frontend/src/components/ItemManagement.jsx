import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Table,
  Tag,
  Space,
  Form,
  Select,
  Card,
  Popconfirm,
  InputNumber,
  Typography,
  message,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  BarChartOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../service/api";
import { canEdit, canDelete, canCreate } from "../service/auth";
import { truncateToFixed } from "../utils/textUtils";
import { useVehicles, useCompressors } from "../hooks/useQueries";

const { Title, Text } = Typography;
const { Option } = Select;

const ItemManagement = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [itemTypeFilter, setItemTypeFilter] = useState("all");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ["10", "20", "50"],
  });

  // Fetch machines and compressors for item type dropdown
  const { data: machines = [] } = useVehicles();
  const { data: compressors = [] } = useCompressors();

  // Build item type options
  const itemTypeOptions = [
    { label: "Drilling Tools", value: "Drilling Tools" },
    ...machines.map((m) => ({
      label: `Machine: ${m.vehicleNumber}`,
      value: m.vehicleNumber,
    })),
    ...compressors.map((c) => ({
      label: `Compressor: ${c.compressorName}`,
      value: c.compressorName,
    })),
  ];

  // Fetch items
  const fetchItems = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      let url = `/api/items?page=${page}&limit=${limit}`;
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      if (itemTypeFilter !== "all") {
        url += `&itemType=${encodeURIComponent(itemTypeFilter)}`;
      }

      const res = await api.get(url);
      setItems(res.data.data || []);

      setPagination((prev) => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
        pageSize: res.data.limit || limit,
      }));
    } catch (err) {
      console.error("Error fetching items", err);
      message.error("Error fetching items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(pagination.current, pagination.pageSize);
  }, []);

  // Refetch when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchItems(1, pagination.pageSize);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, itemTypeFilter]);

  // Initialize month
  const handleInitializeMonth = async () => {
    try {
      await api.post("/api/items/initialize-month");
      message.success("Month initialized successfully");
      fetchItems(pagination.current, pagination.pageSize);
    } catch (err) {
      console.error("Error initializing month", err);
      message.error(err.response?.data?.message || "Error initializing month");
    }
  };

  // Handle form submission
  const handleSubmit = async (values) => {
    if (submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        ...values,
        purchaseRate: Number(values.purchaseRate) || 0,
        gst: values.gst !== undefined ? Number(values.gst) : 0,
        stock: values.stock !== undefined ? Number(values.stock) : 0,
      };

      // Only include balance when editing (for manual override)
      if (editingId && values.balance !== undefined) {
        payload.balance = Number(values.balance);
      }

      if (editingId) {
        await api.put(`/api/items/${editingId}`, payload);
        message.success("Item updated successfully");
      } else {
        await api.post("/api/items", payload);
        message.success("Item created successfully");
      }

      setShowForm(false);
      setEditingId(null);
      form.resetFields();
      fetchItems(pagination.current, pagination.pageSize);
    } catch (err) {
      console.error("Error saving item", err);
      message.error(err.response?.data?.message || "Error saving item");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (record) => {
    setEditingId(record.id);
    setShowForm(true);
    form.setFieldsValue({
      ...record,
      purchaseRate: Number(record.purchaseRate) || 0,
      gst: record.gst !== undefined ? Number(record.gst) : 0,
      stock: record.stock !== undefined ? Number(record.stock) : 0,
      balance: record.balance !== undefined ? Number(record.balance) : 0,
    });
  };

  // Handle delete
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/items/${id}/hard`);
      message.success("Item deleted successfully");
      fetchItems(pagination.current, pagination.pageSize);
    } catch (err) {
      console.error("Error deleting item", err);
      message.error("Error deleting item");
    }
  };

  // Handle table change
  const handleTableChange = (pagination) => {
    fetchItems(pagination.current, pagination.pageSize);
  };

  const columns = [
    { title: "Item Name", dataIndex: "itemName", key: "itemName", fixed: "left", width: 180 },
    { title: "Part Number", dataIndex: "partNumber", key: "partNumber", width: 150 },
    { 
      title: "Item Type", 
      dataIndex: "itemType", 
      key: "itemType",
      width: 180,
      render: (value) => <Tag color="blue">{value}</Tag>
    },
    { title: "Category", dataIndex: "groupName", key: "groupName", width: 150 },
    { title: "Units", dataIndex: "units", key: "units", width: 100 },
    {
      title: "Purchase Rate",
      dataIndex: "purchaseRate",
      key: "purchaseRate",
      width: 140,
      render: (value) => `₹${truncateToFixed(value, 2)}`,
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      width: 150,
      render: (value) => (
        <Text
          strong
          style={{
            color: value > 0 ? "#52c41a" : value < 0 ? "#ff4d4f" : "#000",
            fontSize: "16px",
          }}
        >
          {truncateToFixed(value || 0, 2)}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Space>
          {canEdit() && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            />
          )}
          {canDelete() && (
            <Popconfirm
              title="Are you sure you want to delete this item?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Title level={2}>Item Management & Inventory</Title>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<BarChartOutlined />}
                onClick={() => navigate("/stock-report")}
                type="default"
              >
                View Stock Report
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleInitializeMonth}
                type="default"
              >
                Initialize New Month
              </Button>
              {canCreate() && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setShowForm(!showForm);
                    setEditingId(null);
                    form.resetFields();
                    form.setFieldsValue({ stock: 1, gst: 0 });
                  }}
                >
                  {showForm ? "Cancel" : "Add Item"}
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        {/* Filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={12}>
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={12}>
            <Select
              placeholder="Filter by Item Type"
              value={itemTypeFilter}
              onChange={setItemTypeFilter}
              style={{ width: "100%" }}
              allowClear
              onClear={() => setItemTypeFilter("all")}
            >
              <Option value="all">All Types</Option>
              {itemTypeOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>

        {/* Form */}
        {showForm && (
          <Card style={{ marginBottom: 20, backgroundColor: "#f0f2f5" }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ gst: 0, stock: 1 }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="itemName"
                    label="Item Name"
                    rules={[{ required: true, message: "Please enter item name" }]}
                  >
                    <Input placeholder="Enter item name" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="partNumber"
                    label="Part Number"
                    rules={[{ required: true, message: "Please enter part number" }]}
                  >
                    <Input placeholder="Enter part number" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="itemType"
                    label="Item Type"
                    rules={[{ required: true, message: "Please select item type" }]}
                  >
                    <Select placeholder="Select item type" showSearch>
                      {itemTypeOptions.map((opt) => (
                        <Option key={opt.value} value={opt.value}>
                          {opt.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="groupName"
                    label="Category/Group"
                    rules={[{ required: true, message: "Please enter category" }]}
                  >
                    <Input placeholder="Enter category" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="units"
                    label="Units"
                    rules={[{ required: true, message: "Please select units" }]}
                  >
                    <Select placeholder="Select units">
                      <Option value="kg">Kilograms (kg)</Option>
                      <Option value="ltr">Liters (ltr)</Option>
                      <Option value="mtr">Meters (mtr)</Option>
                      <Option value="nos">Numbers (nos)</Option>
                      <Option value="set">Set</Option>
                      <Option value="unit">Unit</Option>
                      <Option value="kit">Kit</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="stock"
                    label="Initial Stock Quantity"
                    rules={[{ required: true, message: "Please enter stock" }]}
                  >
                    <InputNumber
                      placeholder="Enter quantity"
                      min={0}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="balance"
                    label="Current Balance"
                    rules={[{ required: false }]}
                  >
                    <InputNumber
                      placeholder="Enter balance"
                      min={0}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="purchaseRate"
                    label="Purchase Rate (₹)"
                    rules={[{ required: true, message: "Please enter rate" }]}
                  >
                    <InputNumber
                      placeholder="Enter purchase rate"
                      min={0}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item name="gst" label="GST %">
                    <InputNumber
                      placeholder="Enter GST %"
                      min={0}
                      max={100}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row>
                <Col span={24}>
                  <Space>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={submitting}
                    >
                      {editingId ? "Update" : "Create"} Item
                    </Button>
                    <Button
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(null);
                        form.resetFields();
                      }}
                    >
                      Cancel
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Form>
          </Card>
        )}

        {/* Table */}
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          rowKey="id"
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default ItemManagement;
