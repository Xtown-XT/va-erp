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
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
  });

  const [statusFilter, setStatusFilter] = useState(null);

  // Fetch brands
  const fetchBrands = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/brands?page=${page}&limit=${limit}`);
      setBrands(res.data.data || []);

      // Update pagination state
      setPagination(prev => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
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
            // (brands || [])
                .filter((b) =>
                  b.brandName?.toLowerCase().includes(searchTerm.toLowerCase())
                )
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
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Brand Management</h1>
        <Space>
          <Button
            icon={<FilePdfOutlined />}
            onClick={exportToPDF}
            type="primary"
            danger
          >
            Export PDF
          </Button>
          {canCreate() && (
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
                form.resetFields();
              }}
              type="primary"
            >
              {showForm ? "Cancel" : "Add Brand"}
            </Button>
          )}
        </Space>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="mb-6">
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
                <Select>
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

      {/* Search */}
    <div style={{ marginBottom: 20, display: 'flex', gap: '10px', alignItems: 'center' }}>
      <Input.Search
        placeholder="Search by brand name"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ maxWidth: 300,  }}
      />

        <Select
          placeholder="Filter by Status"
          allowClear
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
          style={{ width: 180 }}
        >
          <Select.Option value="active">Active</Select.Option>
          <Select.Option value="inactive">Inactive</Select.Option>
        </Select>

        
        <Button
          onClick={() => {
            setSearchTerm('');
            setStatusFilter(null);
          }
          }
          disabled={!searchTerm && !statusFilter}
        >
          Clear Filters
        </Button>
        
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={(brands || []).filter((b) => {
          const searchMatch = b.brandName?.toLowerCase().includes(searchTerm.toLowerCase());

          const statusMatch = statusFilter ? 
            b.status?.toLowerCase() === statusFilter.toLowerCase()
            : true;

          return searchMatch && statusMatch;

          }
        )}
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
