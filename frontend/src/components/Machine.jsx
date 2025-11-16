import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Table,
  Tag,
  Space,
  Form,
  Select,
  InputNumber,
  Card,
  Popconfirm,
  message,
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
import { canEdit, canDelete, canCreate } from "../service/auth";
import { useNavigate } from "react-router-dom";

const Machine = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [brands, setBrands] = useState([]);
  const [compressors, setCompressors] = useState([]);
  const [sites, setSites] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
  });

  const [statusFilter, setStatusFilter] = useState(null);

  // Fetch data
  const fetchMachines = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/vehicles?page=${page}&limit=${limit}`); // API route kept for compatibility
      setMachines(res.data.data || []);

      // Update pagination state
      setPagination(prev => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
        pageSize: res.data.limit || limit,
      }));
    } catch (err) {
      console.error("Error fetching machines", err);
      setMachines([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle pagination change
  const handleTableChange = (pagination) => {
    fetchMachines(pagination.current, pagination.pageSize);
  };

  const fetchBrands = async () => {
    try {
      const res = await api.get("/api/brands?limit=1000");
      setBrands(res.data.data || []);
    } catch (err) {
      console.error("Error fetching brands", err);
    }
  };


  const fetchCompressors = async () => {
    try {
      const res = await api.get("/api/compressors?limit=1000");
      setCompressors(res.data.data || []);
    } catch (err) {
      console.error("Error fetching compressors", err);
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
    fetchMachines();
    fetchBrands();
    fetchCompressors();
    fetchSites();
  }, []);

  // Handle form submit (create or update)
  const handleSubmit = async (values) => {
    try {

      // Build payload with only defined values
      const payload = {
        vehicleType: values.vehicleType,
        vehicleNumber: values.vehicleNumber,
        brandId: values.brandId,
      };

      // Add optional fields only if they have values
      if (values.status) {
        payload.status = values.status;
      }

      if (values.vehicleRPM !== undefined && values.vehicleRPM !== null && values.vehicleRPM !== '') {
        payload.vehicleRPM = Number(values.vehicleRPM);
      }

      if (values.nextServiceRPM !== undefined && values.nextServiceRPM !== null && values.nextServiceRPM !== '') {
        payload.nextServiceRPM = Number(values.nextServiceRPM);
      }

      if (values.compressorId) {
        payload.compressorId = values.compressorId;
      }

      if (values.siteId) {
        payload.siteId = values.siteId;
      }

      if (editingId) {
        await api.put(`/api/vehicles/${editingId}`, payload); // API route kept
        message.success("Machine updated successfully");
      } else {
        const res = await api.post("/api/vehicles", payload); // API route kept
        setMachines([res.data.data, ...machines]);
        message.success("Machine created successfully");
      }

      setShowForm(false);
      setEditingId(null);
      form.resetFields();
      fetchMachines();
    } catch (err) {
      console.error("Error saving machine", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to save machine";
      message.error(`Error: ${errorMessage}`);
    }
  };

  // Handle edit
  const handleEdit = (record) => {
    setEditingId(record.id);
    setShowForm(true);
    form.setFieldsValue({
      vehicleType: record.vehicleType || undefined,
      vehicleNumber: record.vehicleNumber || undefined,
      status: record.status || undefined,
      brandId: record.brandId || record.brand?.id || undefined,
      vehicleRPM: record.vehicleRPM ?? undefined,
      nextServiceRPM: record.nextServiceRPM ?? undefined,
      compressorId: record.compressorId || record.compressor?.id || undefined,
      siteId: record.siteId || record.site?.id || undefined,
    });
  };

  // Handle hard delete
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/vehicles/${id}/hard`); // API route kept
      setMachines(machines.filter((machine) => machine.id !== id));
    } catch (err) {
      console.error("Error deleting vehicle", {
        status: err.response?.status,
        data: err.response?.data,
      });
    }
  };

  // PDF Export
  const exportToPDF = async () => {

    const res = await api.get("/api/vehicles?page=1&limit=1000"); // API route kept
    const allMachines = res.data.data || []

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Machine List</title>
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
            <h1>Machine List</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Machine Type</th>
                <th>Machine Number</th>
                <th>Brand</th>
                <th>Machine RPM</th>
                <th>Next Service RPM</th>
                <th>Compressor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${allMachines
            // (machines || [])
        .filter((m) =>
          m.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) // DB column kept
        )
        .map(
          (machine) => {
            // Get brand name
            const brandName = machine.brand?.brandName ||
              brands.find(b => b.id === machine.brandId)?.brandName || "-";


            // Get compressor name
            const compressorName = machine.compressor?.compressorName ||
              compressors.find(c => c.id === machine.compressorId)?.compressorName || "-";

            return `
                    <tr>
                      <td>${machine.vehicleType}</td>
                      <td>${machine.vehicleNumber}</td>
                      <td>${brandName}</td>
                      <td>${machine.vehicleRPM || '-'}</td>
                      <td>${machine.nextServiceRPM || '-'}</td>
                      <td>${compressorName}</td>
                      <td>${machine.status}</td>
                    </tr>`;
          }
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
    { title: "Machine Type", dataIndex: "vehicleType", key: "vehicleType" },
    { title: "Machine Number", dataIndex: "vehicleNumber", key: "vehicleNumber" },
    {
      title: "Brand",
      key: "brandName",
      render: (_, record) => {
        // Try different ways to get brand name
        if (record.brand?.brandName) {
          return record.brand.brandName;
        }
        if (record.brandName) {
          return record.brandName;
        }
        // Find brand by ID if we have the ID
        const brand = brands.find(b => b.id === record.brandId);
        return brand ? brand.brandName : "-";
      }
    },
    { title: "Machine RPM", dataIndex: "vehicleRPM", key: "vehicleRPM" },
    { title: "Next Service RPM", dataIndex: "nextServiceRPM", key: "nextServiceRPM", render: (value) => value || "-" },
    {
      title: "Compressor",
      key: "compressorName",
      render: (_, record) => {
        // Try different ways to get compressor name
        if (record.compressor?.compressorName) {
          return record.compressor.compressorName;
        }
        if (record.compressorName) {
          return record.compressorName;
        }
        // Find compressor by ID if we have the ID
        const compressor = compressors.find(c => c.id === record.compressorId);
        return compressor ? compressor.compressorName : "-";
      }
    },
    {
      title: "Site",
      key: "siteName",
      render: (_, record) => {
        if (record.site?.siteName) {
          return record.site.siteName;
        }
        if (record.siteName) {
          return record.siteName;
        }
        const site = sites.find(s => s.id === record.siteId);
        return site ? site.siteName : "-";
      }
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
          <Button
            icon={<ToolOutlined />}
            onClick={() => navigate(`/reports/machine-service/${record.id}`)} // Changed route
            title="View Service History"
          />
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
              placeholder="Search by vehicle number"
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
                name="vehicleType"
                label="Machine Type"
                rules={[{ required: true }]}
              >
                <Select placeholder="Select machine type" showSearch optionFilterProp="children">
                  <Select.Option value="Truck">Truck</Select.Option>
                  <Select.Option value="Crawler">Crawler</Select.Option>
                  <Select.Option value="Camper">Camper</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="vehicleNumber"
                label="Machine Number"
                rules={[{ required: true }]}
              >
                <Input
                  placeholder="e.g., TN01AB1234"
                />
              </Form.Item>
              <Form.Item
                name="brandId"
                label="Brand"
                rules={[{ required: true }]}
              >
                <Select placeholder="Select brand" showSearch optionFilterProp="children">
                  {brands.map((brand) => (
                    <Select.Option key={brand.id} value={brand.id}>
                      {brand.brandName}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="vehicleRPM"
                label="Machine RPM"
              >
                <InputNumber className="w-full" min={0} step={0.1} precision={1} />
              </Form.Item>
              <Form.Item
                name="nextServiceRPM"
                label="Next Service RPM"
                tooltip="Enter the RPM at which the next service is due"
              >
                <InputNumber className="w-full" min={0} step={0.1} precision={1} placeholder="e.g., 1000" />
              </Form.Item>
              <Form.Item
                name="compressorId"
                label="Compressor"
              >
                <Select placeholder="Select compressor" allowClear showSearch optionFilterProp="children">
                  {compressors.map((compressor) => (
                    <Select.Option key={compressor.id} value={compressor.id}>
                      {compressor.compressorName}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="siteId"
                label="Assigned Site"
                tooltip="Assign this machine to a specific site"
              >
                <Select placeholder="Select site" allowClear showSearch optionFilterProp="children">
                  {sites.map((site) => (
                    <Select.Option key={site.id} value={site.id}>
                      {site.siteName}
                    </Select.Option>
                  ))}
                </Select>
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
            </div>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                {editingId ? "Update Machine" : "Add Machine"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}


      {/* Table */}
      <Table
        columns={columns}
        dataSource={(machines || []).filter((m) => {

          const searchMatch = m.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()); // DB column kept

          const statusMatch = statusFilter
            ? m.status?.toLowerCase() === statusFilter.toLowerCase()
            : true;

          return searchMatch && statusMatch;
        }
        )}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} vehicles`
        }}
        onChange={handleTableChange}
      />
    </div>
  );
};

export default Machine;
