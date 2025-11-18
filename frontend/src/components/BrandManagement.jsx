import { useState, useEffect, useRef } from "react";
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
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  FilePdfOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import { canEdit, canDelete, canCreate } from "../service/auth";

const BrandManagement = () => {
  const [form] = Form.useForm();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
  });

  const [statusFilter, setStatusFilter] = useState(null);
  const isInitialMount = useRef(true);

  // Fetch brands
  const fetchBrands = async (page = 1, limit = 10, status = null) => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      // Use provided value or fall back to state
      const statusValue = status !== null ? status : statusFilter;
      
      if (statusValue) {
        params.append('brandStatus', statusValue);
      }
      
      const res = await api.get(`/api/brands?${params.toString()}`);
      setBrands(res.data.data || []);

      // Update pagination state
      setPagination(prev => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
        pageSize: res.data.limit || limit,
      }));
    } catch (err) {
      console.error("Error fetching brands", err);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands(pagination.current, pagination.pageSize);
  }, []);

  // Refetch when status filter changes
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Reset to page 1 when filter changes
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchBrands(1, pagination.pageSize, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Handle form submit (create or update)
  const handleSubmit = async (values) => {
    try {
      const payload = {
        brandName: values.brandName,
        brandStatus: values.brandStatus,
      };

      if (editingId) {
        await api.put(`/api/brands/${editingId}`, payload);
      } else {
        const res = await api.post("/api/brands", payload);
        setBrands([res.data.data, ...brands]);
      }

      setShowForm(false);
      setEditingId(null);
      form.resetFields();
      fetchBrands(pagination.current, pagination.pageSize);
    } catch (err) {
      console.error("Error saving brand", err);
    }
  };

  // Handle edit
  const handleEdit = (record) => {
    setEditingId(record.id);
    setShowForm(true);
    form.setFieldsValue({
      ...record,
    });
  };

  // Handle hard delete
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/brands/${id}/hard`);
      message.success("Brand deleted successfully");
      fetchBrands(pagination.current, pagination.pageSize);
    } catch (err) {
      console.error("Error deleting brand", err);
      message.error("Error deleting brand");
    }
  };

  // Handle table change
  const handleTableChange = (pagination) => {
    fetchBrands(pagination.current, pagination.pageSize);
  };

  // PDF Export
  const exportToPDF = async () => {

    const res = await api.get("/api/brands?page=1&limit=1000");
    const allBrands = res.data.data || [] 
    
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Brand List</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Brand List</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Brand Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${allBrands
                .map(
                  (brand) => `
                <tr>
                  <td>${brand.brandName}</td>
                  <td>${brand.brandStatus}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Table columns
  const columns = [
    { title: "Brand Name", dataIndex: "brandName", key: "brandName" },
    {
      title: "Status",
      dataIndex: "brandStatus",
      key: "brandStatus",
      render: (status) => {
        const colors = { active: "green", inactive: "red" };
        return <Tag color={colors[status] || "default"}>
            {status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "-"}  
        </Tag>;
      },
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
            <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          )}
          {canDelete() && (
            <Popconfirm
              title="Are you sure to delete?"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button icon={<DeleteOutlined />} danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-2">
      {/* Filters and Actions - Single Row */}
      <Card className="mb-1" bodyStyle={{ padding: '4px' }}>
        <Row gutter={4} align="middle">
          <Col xs={12} sm={4} md={3}>
            <Select
              placeholder="Status"
              allowClear
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPagination(prev => ({ ...prev, current: 1 }));
              }}
              className="w-full"
              size="small"
            >
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="inactive">Inactive</Select.Option>
            </Select>
          </Col>
          <Col xs={12} sm={3} md={2}>
            <Button
              onClick={() => {
                setStatusFilter(null);
                setPagination(prev => ({ ...prev, current: 1 }));
              }}
              disabled={!statusFilter}
              size="small"
              className="w-full"
            >
              Clear
            </Button>
          </Col>
          <Col xs={12} sm={5} md={3}>
            <Button
              icon={<FilePdfOutlined />}
              onClick={exportToPDF}
              type="primary"
              danger
              size="small"
              className="w-full"
            >
              PDF
            </Button>
          </Col>
          {canCreate() && (
            <Col xs={12} sm={6} md={3}>
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  setShowForm(!showForm);
                  setEditingId(null);
                  form.resetFields();
                }}
                type="primary"
                size="small"
                className="w-full"
              >
                {showForm ? "Cancel" : "Add"}
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="mb-1" bodyStyle={{ padding: '8px' }}>
          <Form layout="vertical" form={form} onFinish={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="brandName"
                label="Brand Name"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="brandStatus"
                label="Status"
                rules={[{ required: true }]}
                initialValue="active"
              >
                <Select showSearch optionFilterProp="children">
                  <Select.Option value="active">Active</Select.Option>
                  <Select.Option value="inactive">Inactive</Select.Option>
                </Select>
              </Form.Item>
            </div>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                {editingId ? "Update Brand" : "Add Brand"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* Table */}
      <Table
        columns={columns}
        dataSource={brands || []}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} brands`
        }}
        onChange={handleTableChange}
      />
    </div>
  );
};

export default BrandManagement;
