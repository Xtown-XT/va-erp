import { useState, useEffect } from "react";
import {
  Button,
  Table,
  Tag,
  Space,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Row,
  Col,
  Typography,
  Card,
  Popconfirm,
  Select,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import { canEdit, canDelete, canCreate, getUserRole } from "../service/auth";
import { truncateToFixed } from "../utils/textUtils";

const { Title } = Typography;

const ItemInstanceManagement = () => {
  const [form] = Form.useForm();
  const [itemInstances, setItemInstances] = useState([]);
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
  });

  // Fetch data
  const fetchData = async (page = 1, limit = 10, search = searchTerm, status = statusFilter) => {
    setLoading(true);
    try {
      // Build query params
      let queryParams = `page=${page}&limit=${limit}`;
      if (search) queryParams += `&search=${encodeURIComponent(search)}`;
      if (status && status !== 'all') queryParams += `&status=${status}`;

      const [instancesRes, itemsRes, vehiclesRes] = await Promise.all([
        api.get(`/api/itemInstances?${queryParams}`),
        api.get("/api/items?canBeFitted=true&limit=1000"),
        api.get("/api/vehicles?limit=1000"),
      ]);

      setItemInstances(instancesRes.data.data || []);
      setItems(itemsRes.data.data || []);
      setVehicles(vehiclesRes.data.data || []);

      // Update pagination state
      setPagination(prev => ({
        ...prev,
        current: instancesRes.data.page || page,
        total: instancesRes.data.total || 0,
        pageSize: instancesRes.data.limit || limit,
      }));
    } catch (err) {
      console.error("Error fetching data", err);
      message.error("Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize);
  }, []);

  // Trigger search when filters change with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Reset to page 1 when filters change
      fetchData(1, pagination.pageSize, searchTerm, statusFilter);
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter]);

  // Handle table change
  const handleTableChange = (paginationConfig) => {
    fetchData(paginationConfig.current, paginationConfig.pageSize, searchTerm, statusFilter);
  };

  // Handle form submit
  const handleSubmit = async (values) => {
    try {
      const processedValues = {
        ...values,
        nextServiceRPM: values.nextServiceRPM ? parseInt(values.nextServiceRPM) : null
      };


      if (editingId) {
        await api.put(`/api/itemInstances/${editingId}`, processedValues);
        message.success("Item instance updated successfully");
      } else {
        await api.post("/api/itemInstances", processedValues);
        message.success("Item instance created successfully");
      }

      setShowForm(false);
      setEditingId(null);
      form.resetFields();
      fetchData(pagination.current, pagination.pageSize, searchTerm, statusFilter);
    } catch (err) {
      console.error("Error saving machine item", err);
      message.error("Error saving machine item");
    }
  };

  // Handle edit
  const handleEdit = (record) => {
    setEditingId(record.id);
    setShowForm(true);
    form.setFieldsValue({
      ...record,
      nextServiceRPM: record.nextServiceRPM ?? undefined,
    });
  };

  // Handle delete
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/itemInstances/${id}`);
      message.success("Item instance deleted successfully");
      fetchData(pagination.current, pagination.pageSize, searchTerm, statusFilter);
    } catch (err) {
      console.error("Error deleting machine item", err);
      const errorMessage = err.response?.data?.message || err.message || "Error deleting machine item";
      message.error(errorMessage);
    }
  };

  // Handle create new
  const handleCreate = () => {
    setEditingId(null);
    setShowForm(true);
    form.resetFields();
  };

  // Handle remove fit
  const handleRemoveFit = async (id) => {
    try {
      await api.post(`/api/itemInstances/${id}/remove`, {
        removedDate: new Date().toISOString().split('T')[0]
      });
      message.success("Item unfitted successfully");
      fetchData(pagination.current, pagination.pageSize);
    } catch (err) {
      console.error("Error unfitting item", err);
      message.error(err.response?.data?.message || "Error unfitting item");
    }
  };

  // Table columns
  const columns = [
    {
      title: "Instance Number",
      dataIndex: "instanceNumber",
      key: "instanceNumber",
      sorter: (a, b) => a.instanceNumber.localeCompare(b.instanceNumber),
    },
    {
      title: "Item Name",
      dataIndex: ["item", "itemName"],
      key: "itemName",
    },
    {
      title: "Part Number",
      dataIndex: ["item", "partNumber"],
      key: "partNumber",
    },
    {
      title: "Current RPM",
      dataIndex: "currentRPM",
      key: "currentRPM",
      render: (rpm) => rpm ? truncateToFixed(rpm, 2) : "0.00",
    },
    {
      title: "Next Service RPM",
      dataIndex: "nextServiceRPM",
      key: "nextServiceRPM",
      render: (value) => value ? truncateToFixed(value, 2) : "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status, record) => {
        // Check if actually fitted by checking fittedToVehicleId
        const isFitted = status === "fitted" && record.fittedToVehicleId;
        const color = isFitted ? "green" : status === "in_stock" ? "blue" : "orange";
        const displayStatus = isFitted ? "FITTED" : status?.toUpperCase() || "IN_STOCK";
        return <Tag color={color}>{displayStatus}</Tag>;
      },
    },
    {
      title: "Fitted To",
      dataIndex: ["fittedToMachine", "vehicleNumber"],
      key: "vehicleNumber",
      render: (vehicleNumber) => vehicleNumber || "-",
    },
    {
      title: "Remove Fit",
      key: "removeFit",
      render: (_, record) => {
        const isFitted = record.status === "fitted" && record.fittedToVehicleId;
        return isFitted ? (
          <Popconfirm
            title="Remove this item from the machine?"
            description="The item will be marked as in stock."
            onConfirm={() => handleRemoveFit(record.id)}
          >
            <Button 
              size="small" 
              danger
              icon={<DeleteOutlined />}
            >
              Remove
            </Button>
          </Popconfirm>
        ) : (
          <span>-</span>
        );
      },
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
              title="Are you sure to delete this machine item?"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button
              
                icon={<DeleteOutlined />}
                danger
              >
           
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];


  return (
    <div className="space-y-1">
      {/* Filters and Actions - Single Row */}
      <Card className="mb-1" bodyStyle={{ padding: '4px' }}>
        <Row gutter={4} align="middle">
          <Col xs={24} sm={8} md={7}>
            <Input
              placeholder="Search by instance, name, or part number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Col>
          <Col xs={12} sm={4} md={3}>
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-full"
              size="small"
            >
              <Select.Option value="all">All</Select.Option>
              <Select.Option value="in_stock">In Stock</Select.Option>
              <Select.Option value="fitted">Fitted</Select.Option>
            </Select>
          </Col>
          <Col xs={12} sm={4} md={2}>
            <Button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              disabled={!searchTerm && statusFilter === 'all'}
              size="small"
              className="w-full"
            >
              Clear
            </Button>
          </Col>
          {canCreate() && (
            <Col xs={24} sm={8} md={4}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                disabled={loading}
                size="small"
                className="w-full"
              >
                Add Machine Item
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          // dataSource={itemInstances}
          dataSource={itemInstances.filter((item) =>
            item.instanceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.item?.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.item?.partNumber?.toLowerCase().includes(searchTerm.toLowerCase())
          )}

          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* Form Modal */}
      <Modal
        title={editingId ? "Edit Machine Item" : "Add Machine Item"}
        open={showForm}
        onCancel={() => {
          setShowForm(false);
          setEditingId(null);
          form.resetFields();
        }}
        onOk={() => {
          form.submit();
        }}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="itemId"
                label="Item"
                rules={[{ required: true, message: "Please select an item" }]}
              >
                <Select placeholder="Select item" showSearch optionFilterProp="children">
                  {items.map((item) => (
                    <Select.Option key={item.id} value={item.id}>
                      {item.itemName} ({item.partNumber})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="instanceNumber"
                label="Instance Number"
                rules={[{ required: true, message: "Please enter instance number" }]}
              >
                <Input placeholder="e.g., Hammer-001" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="currentRPM"
                label="Current RPM"
                rules={[{ required: true, message: "Please enter current RPM" }]}
              >
                <InputNumber
                  min={0}
                  step={0.1}
                  precision={1}
                  style={{ width: "100%" }}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="nextServiceRPM"
                label="Next Service RPM"
                help="Enter the RPM at which the next service is due"
              >
                <InputNumber className="w-full" min={0} step={0.1} precision={1} placeholder="e.g., 1000" />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>

    </div>
  );
};

export default ItemInstanceManagement;
