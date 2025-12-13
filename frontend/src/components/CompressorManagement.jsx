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
  DatePicker,
  InputNumber,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  FilePdfOutlined,
  EditOutlined,
  DeleteOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import { canEdit, canDelete } from "../service/auth";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import MaintenanceModal from "./MaintenanceModal"; // Import

const CompressorManagement = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [compressors, setCompressors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [selectedCompressorForMaintenance, setSelectedCompressorForMaintenance] = useState(null);
  const [sites, setSites] = useState([]);

  // Fetch compressors
  const fetchCompressors = async (page = 1, limit = 10, search = searchTerm) => {
    setLoading(true);
    try {
      let queryParams = `page=${page}&limit=${limit}`;
      if (search) queryParams += `&search=${encodeURIComponent(search)}`;

      const res = await api.get(`/api/compressors?${queryParams}`);
      setCompressors(res.data.data || []);

      // Update pagination state
      setPagination(prev => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
        pageSize: res.data.limit || limit,
      }));
    } catch (err) {
      console.error("Error fetching compressors", err);
      setCompressors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await api.get("/api/sites?limit=1000");
      setSites(res.data.data || []);
    } catch (err) {
      console.error("Error fetching sites", err);
    }
  };

  useEffect(() => {
    fetchCompressors(pagination.current, pagination.pageSize);
    fetchSites();
  }, []);

  // Handle pagination change
  const handleTableChange = (paginationConfig) => {
    fetchCompressors(paginationConfig.current, paginationConfig.pageSize, searchTerm);
  };

  // Trigger search when searchTerm changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCompressors(1, pagination.pageSize, searchTerm);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Handle form submit (create or update)
  const handleSubmit = async (values) => {
    try {
      const payload = {
        compressorName: values.compressorName,
        status: values.status,
        serialNumber: values.serialNumber || null,
        purchaseDate: values.purchaseDate ? values.purchaseDate.format("YYYY-MM-DD") : null,
        compressorRPM: values.compressorRPM ?? null,
      };

      if (editingId) {
        await api.put(`/api/compressors/${editingId}`, payload);
      } else {
        const res = await api.post("/api/compressors", payload);
        setCompressors([res.data.data, ...compressors]);

      }

      setShowForm(false);
      setEditingId(null);
      form.resetFields();
      fetchCompressors(pagination.current, pagination.pageSize, searchTerm);
    } catch (err) {
      console.error("Error saving compressor", err);
    }
  };

  // Handle edit
  const handleEdit = (record) => {
    setEditingId(record.id);
    setShowForm(true);
    form.setFieldsValue({
      ...record,
      purchaseDate: record.purchaseDate ? dayjs(record.purchaseDate) : null,
      compressorRPM: record.compressorRPM ?? null
    });
  };

  // Handle hard delete
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/compressors/${id}/hard`);
      fetchCompressors(pagination.current, pagination.pageSize, searchTerm);
    } catch (err) {
      console.error("Error deleting compressor", err);
    }
  };

  // PDF Export
  const exportToPDF = async () => {

    const res = await api.get("/api/compressors?page=1&limit=1000");
    const allCompressors = res.data.data || [];

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Compressor List</title>
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
            <h1>Compressor List</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Compressor Name</th>
                <th>Compressor RPM</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${allCompressors
        .filter((c) =>
          c.compressorName?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map(
          (compressor) => `
                <tr>
                  <td>${compressor.compressorName}</td>
                  <td>${compressor.compressorRPM || 0}</td>
                  <td>${compressor.status}</td>
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
    { title: "Compressor Name", dataIndex: "compressorName", key: "compressorName" },
    { title: "Serial Number", dataIndex: "serialNumber", key: "serialNumber" },
    {
      title: "Purchase Date",
      dataIndex: "purchaseDate",
      key: "purchaseDate",
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: "Compressor RPM",
      dataIndex: "compressorRPM",
      key: "compressorRPM",
      render: (value) => value || 0,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
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
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<ToolOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCompressorForMaintenance(record);
              setMaintenanceModalVisible(true);
            }}
            title="Maintenance"
          >
            Maint.
          </Button>
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
          <Col xs={24} sm={6} md={5}>
            <Input.Search
              placeholder="Search by compressor name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Col>
          <Col xs={12} sm={4} md={3}>
            <Select
              placeholder="Status"
              allowClear
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
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
                setSearchTerm('');
                setStatusFilter(null);
              }}
              disabled={!searchTerm && !statusFilter}
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
          {canEdit() && (
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
                name="compressorName"
                label="Compressor Name"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true }]}
                initialValue="active"
              >
                <Select showSearch optionFilterProp="children">
                  <Select.Option value="active">Active</Select.Option>
                  <Select.Option value="inactive">Inactive</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="serialNumber"
                label="Serial Number"
              >
                <Input placeholder="Enter serial number" />
              </Form.Item>
              <Form.Item
                name="purchaseDate"
                label="Purchase Date"
              >
                <DatePicker className="w-full" />
              </Form.Item>
              <Form.Item
                name="compressorRPM"
                label="Compressor RPM"
                rules={[{ type: 'number', min: 0 }]}
              >
                <InputNumber
                  className="w-full"
                  min={0}
                  placeholder="Enter compressor RPM"
                />
              </Form.Item>
            </div>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                {editingId ? "Update Compressor" : "Add Compressor"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}


      {/* Table */}
      <Table
        columns={columns}
        // dataSource={compressors}
        dataSource={(compressors || []).filter((c) => {
          const searchMatch = c.compressorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())

          const statusMatch = statusFilter
            ? c.status?.toLowerCase() === statusFilter.toLowerCase()
            : true;

          return searchMatch && statusMatch;
        }
        )}

        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} compressors`,
        }}
        onChange={handleTableChange}
      />

      <MaintenanceModal
        visible={maintenanceModalVisible}
        onClose={() => setMaintenanceModalVisible(false)}
        asset={selectedCompressorForMaintenance}
        assetType="compressor"
        sites={sites}
        onSuccess={() => fetchCompressors(pagination.current, pagination.pageSize, searchTerm)}
      />
    </div>
  );
};

export default CompressorManagement;
