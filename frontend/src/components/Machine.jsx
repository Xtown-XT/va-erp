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
import MaintenanceModal from "./MaintenanceModal"; // Import

const Machine = () => {
  const [form] = Form.useForm();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [brands, setBrands] = useState([]);
  const [compressors, setCompressors] = useState([]);
  const [sites, setSites] = useState([]);
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [selectedMachineForMaintenance, setSelectedMachineForMaintenance] = useState(null);

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
      const res = await api.get(`/api/machines?page=${page}&limit=${limit}`);
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
        machineType: values.machineType,
        machineNumber: values.machineNumber,
        brandId: values.brandId,
      };

      // Add optional fields only if they have values
      if (values.status) {
        payload.status = values.status;
      }

      if (values.machineRPM !== undefined && values.machineRPM !== null && values.machineRPM !== '') {
        payload.machineRPM = Number(values.machineRPM);
      }

      // Legacy Service fields removed from UI

      // Always include compressorId - send null if cleared (for updates)
      if (editingId) {
        // For updates, explicitly set to null if cleared, or to the value if selected
        payload.compressorId = values.compressorId || null;
      } else {
        // For creates, only include if a value is selected
        if (values.compressorId) {
          payload.compressorId = values.compressorId;
        }
      }

      // Always include siteId - send null if cleared (for updates)
      if (editingId) {
        // For updates, explicitly set to null if cleared, or to the value if selected
        payload.siteId = values.siteId || null;
      } else {
        // For creates, only include if a value is selected
        if (values.siteId) {
          payload.siteId = values.siteId;
        }
      }

      if (editingId) {
        await api.put(`/api/machines/${editingId}`, payload);
        message.success("Machine updated successfully");
      } else {
        const res = await api.post("/api/machines", payload);
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
    console.log('handleEdit called with record:', record);
    setEditingId(record.id);
    setShowForm(true);
    // Use setTimeout to ensure form is mounted before setting values
    setTimeout(() => {
      form.setFieldsValue({
        machineType: record.machineType || undefined,
        machineNumber: record.machineNumber || undefined,
        status: record.status || undefined,
        brandId: record.brandId || record.brand?.id || undefined,
        machineRPM: record.machineRPM ?? undefined,
        // Service fields removed
        compressorId: record.compressorId || record.compressor?.id || undefined,
        siteId: record.siteId || record.site?.id || undefined,
      });
      // Scroll to form after it's rendered
      const formCard = document.querySelector('.machine-edit-form');
      if (formCard) {
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Handle hard delete
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/machines/${id}/hard`);
      setMachines(machines.filter((machine) => machine.id !== id));
    } catch (err) {
      console.error("Error deleting machine", {
        status: err.response?.status,
        data: err.response?.data,
      });
    }
  };

  // PDF Export
  const exportToPDF = async () => {

    const res = await api.get("/api/machines?page=1&limit=1000");
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
                <th>Compressor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${allMachines
        // (machines || [])
        .filter((m) =>
          m.machineNumber?.toLowerCase().includes(searchTerm.toLowerCase())
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
                      <td>${machine.machineType}</td>
                      <td>${machine.machineNumber}</td>
                      <td>${brandName}</td>
                      <td>${machine.machineRPM || '-'}</td>
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
    { title: "Machine Type", dataIndex: "machineType", key: "machineType" },
    { title: "Machine Number", dataIndex: "machineNumber", key: "machineNumber" },
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
    { title: "Machine RPM", dataIndex: "machineRPM", key: "machineRPM" },
    // Legacy Next Service RPM column removed
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
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<ToolOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMachineForMaintenance(record);
              setMaintenanceModalVisible(true);
            }}
            title="Maintenance"
          >
            Maint.
          </Button>
          {canEdit() && (
            <Button
              type="button"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(record);
              }}
            />
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
              placeholder="Search by machine number"
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
        <Card className="mb-1 machine-edit-form" bodyStyle={{ padding: '8px' }}>
          <Form layout="vertical" form={form} onFinish={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="machineType"
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
                name="machineNumber"
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
                name="machineRPM"
                label="Machine RPM"
              >
                <InputNumber className="w-full" min={0} step={0.1} precision={1} />
              </Form.Item>

              {/* Legacy Service Cycle field removed */}

              <Form.Item
                name="compressorId"
                label="Compressor"
              >
                <Select placeholder="Select compressor" allowClear showSearch optionFilterProp="children">
                  {compressors.map((compressor) => (
                    <Select.Option key={compressor.id} value={compressor.id}>
                      {compressor.compressorName} ({compressor.serialNumber})
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
                {editingId ? "Update Machine" : "Update Machine"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}


      {/* Table */}
      <Table
        columns={columns}
        dataSource={(machines || []).filter((m) => {

          const searchMatch = m.machineNumber?.toLowerCase().includes(searchTerm.toLowerCase());

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
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} machines`
        }}
        onChange={handleTableChange}
      />

      <MaintenanceModal
        visible={maintenanceModalVisible}
        onClose={() => setMaintenanceModalVisible(false)}
        asset={selectedMachineForMaintenance}
        assetType="machine"
        sites={sites}
        onSuccess={fetchMachines}
      />
    </div>
  );
};

export default Machine;
