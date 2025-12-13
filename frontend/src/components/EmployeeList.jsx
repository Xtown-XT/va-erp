import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Table,
  Tag,
  Space,
  Form,
  Select,
  DatePicker,
  Card,
  Popconfirm,
  InputNumber,
  Typography,
  Row,
  Col,
  message, // Added message
} from "antd";
import {
  PlusOutlined,
  FilePdfOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import { canEdit, canDelete, canCreate } from "../service/auth";
import { truncateToFixed } from "../utils/textUtils";
import dayjs from "dayjs";
import EmployeeWorkHistoryModal from "./EmployeeWorkHistoryModal";

const EmployeeList = () => {
  const [form] = Form.useForm();
  const [employees, setEmployees] = useState([]);
  const [sites, setSites] = useState([]); // State for sites
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

  // Work history modal state
  const [showWorkHistory, setShowWorkHistory] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Fetch employees
  const fetchEmployees = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      // Include site association in attributes if backend supports it or just use flat fields
      const search = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
      const status = statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : '';

      const res = await api.get(`/api/employeeLists?page=${page}&limit=${limit}${search}${status}`);
      setEmployees(res.data.data || []);

      // Update pagination state
      setPagination(prev => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
        pageSize: res.data.limit || limit,
      }));
    } catch (err) {
      console.error("Error fetching employees", err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sites for dropdown
  const fetchSites = async () => {
    try {
      const res = await api.get("/api/sites?page=1&limit=1000"); // Fetch all sites
      setSites(res.data.data || []);
    } catch (err) {
      console.error("Error fetching sites", err);
      message.error("Failed to load sites");
    }
  };

  // Handle pagination change
  const handleTableChange = (pagination) => {
    fetchEmployees(pagination.current, pagination.pageSize);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees(1, pagination.pageSize);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchSites(); // Load sites on mount
  }, []);

  // Handle form submit (create or update)
  const handleSubmit = async (values) => {
    try {
      const currentUser = localStorage.getItem("username") || "Unknown";
      const payload = {
        empId: values.empId,
        name: values.name,
        designation: values.designation || null,
        phone: values.phone || null,
        joiningDate: values.joiningDate
          ? values.joiningDate.format("YYYY-MM-DD")
          : null,
        status: values.status,
        advancedAmount: (values.advancedAmount !== undefined && values.advancedAmount !== null && values.advancedAmount !== '')
          ? Number(values.advancedAmount)
          : null,
        siteId: values.siteId || null, // Add siteId
        dailySalary: values.dailySalary ? Number(values.dailySalary) : 0, // Add dailySalary
      };

      if (editingId) {
        payload.updatedBy = currentUser;
        await api.put(`/api/employeeLists/${editingId}`, payload);
        message.success("Employee updated successfully");
      } else {
        payload.createdBy = currentUser;
        const res = await api.post("/api/employeeLists", payload);
        // setEmployees([res.data.data, ...employees]); // Don't manually add, refetch to respect sort/pagination
        message.success("Employee created successfully");
      }

      setShowForm(false);
      setEditingId(null);
      form.resetFields();
      fetchEmployees(pagination.current, pagination.pageSize);
    } catch (err) {
      console.error("Error saving employee", err);
      message.error("Error saving employee");
    }
  };

  // Handle edit
  const handleEdit = (record) => {
    setEditingId(record.id);
    setShowForm(true);
    form.setFieldsValue({
      ...record,
      joiningDate: record.joiningDate ? dayjs(record.joiningDate) : null,
      advancedAmount: record.advancedAmount || 0,
      dailySalary: record.dailySalary || 0, // Set daily salary
      siteId: record.siteId || null, // Set site
    });
  };

  // Handle hard delete
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/employeeLists/${id}/hard`);
      setEmployees(employees.filter((emp) => emp.id !== id));
      message.success("Employee deleted successfully");
    } catch (err) {
      console.error("Error deleting employee", err);
      message.error("Error deleting employee");
    }
  };

  // Handle view work history
  const handleViewWorkHistory = (employee) => {
    setSelectedEmployee(employee);
    setShowWorkHistory(true);
  };


  // PDF Export
  const exportToPDF = async () => {
    const res = await api.get("/api/employeeLists?page=1&limit=1000");
    const allEmployees = res.data.data || [];

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Employee List</title>
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
            <h1>Employee List</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Site</th>
                <th>Designation</th>
                <th>Phone</th>
                <th>Joining Date</th>
                <th>Daily Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
            ${allEmployees
        .filter((e) =>
          e.name?.toLowerCase().includes(searchTerm.toLowerCase())
          || e.empId?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map(
          (emp) => {
            const siteName = sites.find(s => s.id === emp.siteId)?.siteName || '-';
            return `
                <tr>
                  <td>${emp.empId}</td>
                  <td>${emp.name}</td>
                  <td>${siteName}</td>
                  <td>${emp.designation || "-"}</td>
                  <td>${emp.phone || "-"}</td>
                  <td>${emp.joiningDate
                ? dayjs(emp.joiningDate).format("YYYY-MM-DD")
                : "-"
              }</td>
                  <td>₹${emp.dailySalary || 0}</td>
                  <td>${emp.status}</td>
                </tr>`
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
    { title: "Emp ID", dataIndex: "empId", key: "empId", width: 100 },
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "Site",
      dataIndex: "siteId",
      key: "siteId",
      render: (siteId) => sites.find(s => s.id === siteId)?.siteName || '-',
      width: 150
    },
    { title: "Designation", dataIndex: "designation", key: "designation" },
    { title: "Phone", dataIndex: "phone", key: "phone" },
    {
      title: "Daily Salary",
      dataIndex: "dailySalary",
      key: "dailySalary",
      render: (salary) => (
        <Typography.Text>
          ₹{truncateToFixed(salary || 0, 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        </Typography.Text>
      ),
      width: 120
    },
    {
      title: "Joining Date",
      dataIndex: "joiningDate",
      key: "joiningDate",
      render: (date) => (date ? dayjs(date).format("YYYY-MM-DD") : "-"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const colors = { active: "green", inactive: "orange", resigned: "red" };
        return <Tag color={colors[status] || "default"}>
          {status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "-"}
        </Tag>;
      },
      width: 100
    },
    {
      title: "Advanced",
      dataIndex: "advancedAmount",
      key: "advancedAmount",
      render: (amount) => (
        <Typography.Text strong type={amount > 0 ? "danger" : "secondary"}>
          ₹{truncateToFixed(amount || 0, 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        </Typography.Text>
      ),
      width: 120
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewWorkHistory(record)}
            title="View Work History"
          >
          </Button>
          {canEdit() && (
            <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          )}
          {canDelete() && (
            <Popconfirm
              title="Are you sure to delete this record permanently?"
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
      <Card className="mb-1" styles={{ body: { padding: '4px' } }}>
        <Row gutter={4} align="middle">
          <Col xs={24} sm={6} md={5}>
            <Input.Search
              placeholder="Search by name or ID"
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
              <Select.Option value="resigned">Resigned</Select.Option>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Form.Item
                name="empId"
                label="Employee ID"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>

              <Form.Item name="siteId" label="Site">
                <Select
                  placeholder="Select Site"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {sites.map(site => (
                    <Select.Option key={site.id} value={site.id}>{site.siteName}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="dailySalary" label="Daily Salary (₹)" initialValue={0}>
                <InputNumber
                  className="w-full"
                  min={0}
                  step={100}
                  precision={2}
                />
              </Form.Item>

              <Form.Item name="designation" label="Designation">
                <Input />
              </Form.Item>
              <Form.Item
                name="phone"
                label="Phone"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) {
                        return Promise.resolve();
                      }
                      if (!/^\d{10}$/.test(value)) {
                        return Promise.reject(new Error("Phone number must be exactly 10 digits"));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input placeholder="Enter 10-digit phone number (optional)"

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
              <Form.Item name="joiningDate" label="Joining Date">
                <DatePicker className="w-full" />
              </Form.Item>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true }]}
                initialValue="active"
              >
                <Select>
                  <Select.Option value="active">Active</Select.Option>
                  <Select.Option value="inactive">Inactive</Select.Option>
                  <Select.Option value="resigned">Resigned</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="advancedAmount"
                label="Advanced Amount (₹)"
                rules={[
                  {
                    validator: (_, value) => {
                      if (value === undefined || value === null || value === '') {
                        return Promise.resolve();
                      }
                      const numValue = Number(value);
                      if (isNaN(numValue)) {
                        return Promise.reject(new Error("Please enter a valid number"));
                      }
                      if (numValue < 0) {
                        return Promise.reject(new Error("Advanced amount cannot be negative"));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <InputNumber
                  className="w-full"
                  min={0}
                  step={0.01}
                  precision={2}
                  formatter={value => value ? `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                  parser={value => value ? value.replace(/₹\s?|(,*)/g, '') : ''}
                  placeholder="Enter advanced amount (optional)"
                />
              </Form.Item>
            </div>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                {editingId ? "Update Employee" : "Add Employee"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}


      {/* Table */}
      <Table
        columns={columns}
        dataSource={employees || []}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} employees`
        }}
        onChange={handleTableChange}
        scroll={{ x: 1000 }} // Enable horizontal scroll for table
      />

      {/* Work History Modal */}
      <EmployeeWorkHistoryModal
        visible={showWorkHistory}
        onClose={() => {
          setShowWorkHistory(false);
          setSelectedEmployee(null);
        }}
        employeeId={selectedEmployee?.id}
        employeeName={selectedEmployee?.name}
      />
    </div>
  );
};

export default EmployeeList;
