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
  Switch,
  Typography,
  message,
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
import { truncateToFixed } from "../utils/textUtils";

const { Title, Text } = Typography;

const ItemManagement = () => {
  const [form] = Form.useForm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [canBeFittedFilter, setCanBeFittedFilter] = useState("all"); // "all", "true", "false"
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
  });

  // Fetch items
  const fetchItems = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      let url = `/api/items?page=${page}&limit=${limit}`;
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      if (canBeFittedFilter !== "all") {
        url += `&canBeFitted=${canBeFittedFilter}`;
      }
      
      const res = await api.get(url);
      let itemsData = res.data.data || [];
      
      // Backend returns grouped items when canBeFitted=true
      // We need to flatten them to show individual units
      const flattenedItems = [];
      itemsData.forEach(item => {
        if (item.canBeFitted && item.items && Array.isArray(item.items) && item.items.length > 0) {
          // This is a grouped fittable item - show individual units
          flattenedItems.push(...item.items);
        } else {
          // Regular item or non-fittable (already individual)
          flattenedItems.push(item);
        }
      });
      
      setItems(flattenedItems);

      // Update pagination state
      setPagination(prev => ({
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
  }, [searchTerm, canBeFittedFilter]);

 

  // Handle form submission
  const handleSubmit = async (values) => {
    // Prevent duplicate submissions
    if (submitting) {
      return;
    }
    
    setSubmitting(true);
    try {
      // Ensure numeric fields are numbers
      const payload = {
        ...values,
        purchaseRate: Number(values.purchaseRate) || 0,
        gst: values.gst !== undefined ? Number(values.gst) : 0,
        stock: values.canBeFitted ? null : (values.stock !== undefined ? Number(values.stock) : 1),
        canBeFitted: values.canBeFitted || false,
        currentRPM: values.canBeFitted ? (Number(values.currentRPM) || 0) : undefined,
        nextServiceRPM: values.canBeFitted ? (values.nextServiceRPM !== undefined ? Number(values.nextServiceRPM) : undefined) : undefined,
      };

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
      stock: record.canBeFitted ? 1 : (record.stock !== null && record.stock !== undefined ? Number(record.stock) : 1),
      canBeFitted: record.canBeFitted || false,
      currentRPM: record.currentRPM !== undefined ? Number(record.currentRPM) : 0,
      nextServiceRPM: record.nextServiceRPM !== undefined ? Number(record.nextServiceRPM) : undefined,
    });
  };


  // Handle hard delete
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

  // Export to PDF
  const exportToPDF = async () => {

    const res = await api.get("/api/items?page=1&limit=1000"); 
    const allItems = res.data.data || [];
    
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Item Management Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
            .item-detail { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
            .rpm-info { background-color: #e6f7ff; padding: 8px; border-radius: 3px; margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Item Management Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <p><strong>Total Items:</strong> ${allItems.length}</p>
            <p><strong>Total Stock Value:</strong> ₹${allItems.reduce((sum, item) => sum + ((item.stock || 0) * (item.purchaseRate || 0)), 0).toLocaleString()}</p>
            <p><strong>Items with Stock:</strong> ${allItems.filter(item => (item.stock || 0) > 0).length}</p>
            <p><strong>Items Out of Stock:</strong> ${allItems.filter(item => (item.stock || 0) === 0).length}</p>
          </div>
          
          <h3>Item Details</h3>
    
          ${allItems
          // items
          
          .map(item => `
            <div class="item-detail">
              <h4>${item.itemName} (${item.partNumber || 'No Part Number'})</h4>
              <p><strong>Group:</strong> ${item.groupName || 'N/A'} | <strong>Units:</strong> ${item.units || 'N/A'}</p>
              <p><strong>Unit Price:</strong> ₹${item.purchaseRate || 0} | <strong>GST:</strong> ${item.gst || 0}%</p>
              <p><strong>Stock Available:</strong> <span style="color: ${(item.stock || 0) > 0 ? 'green' : 'red'}; font-weight: bold;">${item.stock || 0}</span></p>
              <p><strong>Can Be Fitted:</strong> ${item.canBeFitted ? 'Yes' : 'No'}</p>
              ${item.canBeFitted && item.instances && item.instances.length > 0 ? `
                <div class="rpm-info">
                  <strong>Machine Items with RPM Tracking:</strong>
                  <ul>
                    ${item.instances.map(instance => `
                      <li>
                        <strong>${instance.instanceNumber}:</strong> 
                        Current RPM: ${instance.currentRPM || 0} | 
                        Status: ${instance.status} | 
                        Service Schedule: ${instance.serviceSchedule && instance.serviceSchedule.length > 0 ? instance.serviceSchedule.join(', ') + ' RPM' : 'Not set'}
                        ${instance.fittedToVehicle ? ` | Fitted to: ${instance.fittedToVehicle.vehicleNumber || 'Unknown'}` : ''}
                      </li>
                    `).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const columns = [
    { title: "Item Name", dataIndex: "itemName", key: "itemName" },
    { title: "Part Number", dataIndex: "partNumber", key: "partNumber" },
    { title: "Category", dataIndex: "groupName", key: "groupName" },
    { title: "Units", dataIndex: "units", key: "units" },
    {
      title: "Purchase Rate",
      dataIndex: "purchaseRate",
      key: "purchaseRate",
      render: (value) => `₹${truncateToFixed(value, 2)}`,
    },
    {
      title: "GST %",
      dataIndex: "gst",
      key: "gst",
      render: (value) => value ? `${value}%` : 'No GST',
    },
    {
      title: "Can Be Fitted",
      dataIndex: "canBeFitted",
      key: "canBeFitted",
      render: (value) => (
        <Tag color={value ? "blue" : "default"}>
          {value ? "Yes" : "No"}
        </Tag>
      ),
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      render: (value, record) => {
        // For fittable items, stock is calculated from status count
        const stockValue = value !== null && value !== undefined ? value : (record.in_stock || 0);
        return (
          <Text strong style={{ 
            color: stockValue > 0 ? '#52c41a' : '#ff4d4f',
            fontSize: '16px'
          }}>
            {stockValue}
          </Text>
        );
      },
    },
    {
      title: "Current RPM",
      dataIndex: "currentRPM",
      key: "currentRPM",
      render: (value, record) => {
        // Only show for fittable items
        if (record.canBeFitted) {
          return truncateToFixed(value || 0, 2);
        }
        return '-';
      },
    },
    {
      title: "Next Service RPM",
      dataIndex: "nextServiceRPM",
      key: "nextServiceRPM",
      render: (value, record) => {
        // Only show for fittable items
        if (record.canBeFitted) {
          return value ? truncateToFixed(value, 2) : '-';
        }
        return '-';
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value, record) => {
        // Only show for fittable items
        if (record.canBeFitted) {
          const statusColors = {
            'in_stock': 'green',
            'fitted': 'blue',
            'removed': 'default'
          };
          return value ? <Tag color={statusColors[value] || 'default'}>{value}</Tag> : '-';
        }
        return '-';
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
            <Button
             
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
          
            </Button>
          )}
          {canDelete() && (
            <Popconfirm
              title="Are you sure you want to delete this item?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button  danger icon={<DeleteOutlined />}>
              
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      {/* Header */}
      {!showForm && (
        <div className="flex justify-end items-center mb-2">
          <Space>
            <Button
              icon={<FilePdfOutlined />}
              onClick={exportToPDF}
              type="primary"
              danger
              size="small"
            >
              Export PDF
            </Button>
            {canCreate() && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setShowForm(true);
                  setEditingId(null);
                  form.resetFields();
                  form.setFieldsValue({ stock: 1, canBeFitted: false });
                }}
                size="small"
              >
                Add Item
              </Button>
            )}
          </Space>
        </div>
      )}

      {/* Form - Compact Layout */}
      {showForm && (
        <Card 
          title={editingId ? "Edit Item" : "Add New Item"} 
          className="mb-1" 
          bodyStyle={{ padding: '4px' }}
        >
          <Form layout="vertical" form={form} onFinish={handleSubmit}>
            <div style={{ padding: '0', margin: '0' }}>
              {/* Row 1: Item Name, Part Number, Category */}
              <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
                <Col span={8}>
                  <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Item Name *</Text>
                  <Form.Item
                    name="itemName"
                    rules={[{ required: true }]}
                    style={{ marginBottom: '2px' }}
                  >
                    <Input size="small" style={{ fontSize: '11px' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Part Number *</Text>
                  <Form.Item 
                    name="partNumber" 
                    rules={[{ required: true, message: "Part number is required" }]}
                    style={{ marginBottom: '2px' }}
                  >
                    <Input size="small" style={{ fontSize: '11px' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Category *</Text>
                  <Form.Item
                    name="groupName"
                    rules={[{ required: true, message: "Please enter category" }]}
                    style={{ marginBottom: '2px' }}
                  >
                    <Input size="small" style={{ fontSize: '11px' }} />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 2: Units, Purchase Rate, GST */}
              <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
                <Col span={8}>
                  <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Units *</Text>
                  <Form.Item
                    name="units"
                    rules={[{ required: true, message: "Please select units" }]}
                    style={{ marginBottom: '2px' }}
                  >
                    <Select 
                      size="small" 
                      placeholder="Select units" 
                      showSearch 
                      optionFilterProp="children"
                      style={{ fontSize: '11px' }}
                    >
                      <Select.Option value="kg">kg</Select.Option>
                      <Select.Option value="ltr">ltr</Select.Option>
                      <Select.Option value="mtr">mtr</Select.Option>
                      <Select.Option value="nos">nos</Select.Option>
                      <Select.Option value="set">set</Select.Option>
                      <Select.Option value="unit">unit</Select.Option>
                      <Select.Option value="kit">kit</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Purchase Rate (₹) *</Text>
                  <Form.Item
                    name="purchaseRate"
                    rules={[{ required: true, message: "Please enter purchase rate" }]}
                    style={{ marginBottom: '2px' }}
                  >
                    <InputNumber
                      size="small"
                      className="w-full"
                      min={0}
                      step={0.01}
                      precision={2}
                      placeholder="0.00"
                      style={{ width: '100%', fontSize: '11px' }}
                      controls={false}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>GST % (Optional)</Text>
                  <Form.Item
                    name="gst"
                    rules={[{ type: 'number', min: 0, max: 100 }]}
                    style={{ marginBottom: '2px' }}
                  >
                    <InputNumber
                      size="small"
                      className="w-full"
                      min={0}
                      max={100}
                      step={0.01}
                      precision={2}
                      placeholder="0.00"
                      style={{ width: '100%', fontSize: '11px' }}
                      controls={false}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 3: Stock, Can Be Fitted */}
              <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
                <Col span={8}>
                  <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Stock</Text>
                  <Form.Item
                    name="stock"
                    rules={[{ type: 'number', min: 0 }]}
                    style={{ marginBottom: '2px' }}
                    initialValue={1}
                  >
                    <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.canBeFitted !== currentValues.canBeFitted} noStyle>
                      {({ getFieldValue }) => {
                        const canBeFitted = getFieldValue('canBeFitted');
                        return (
                          <InputNumber
                            size="small"
                            className="w-full"
                            min={0}
                            step={0.1}
                            precision={1}
                            placeholder="1"
                            style={{ width: '100%', fontSize: '11px' }}
                            disabled={canBeFitted}
                            controls={false}
                          />
                        );
                      }}
                    </Form.Item>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Can Be Fitted</Text>
                  <Form.Item
                    name="canBeFitted"
                    valuePropName="checked"
                    style={{ marginBottom: '2px' }}
                    initialValue={false}
                  >
                    <Switch 
                      size="small"
                      onChange={(checked) => {
                        if (checked) {
                          form.setFieldsValue({ stock: 1 });
                        } else {
                          form.setFieldsValue({ currentRPM: undefined, nextServiceRPM: undefined });
                        }
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 4: RPM Fields (only when canBeFitted is true) */}
              <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.canBeFitted !== currentValues.canBeFitted}>
                {({ getFieldValue }) => {
                  const canBeFitted = getFieldValue('canBeFitted');
                  if (canBeFitted) {
                    return (
                      <Row gutter={[4, 4]} style={{ marginBottom: '4px' }}>
                        <Col span={8}>
                          <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Current RPM</Text>
                          <Form.Item
                            name="currentRPM"
                            rules={[{ type: 'number', min: 0 }]}
                            style={{ marginBottom: '2px' }}
                          >
                            <InputNumber
                              size="small"
                              className="w-full"
                              min={0}
                              step={0.1}
                              precision={2}
                              placeholder="0.00"
                              style={{ width: '100%', fontSize: '11px' }}
                              controls={false}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Next Service RPM</Text>
                          <Form.Item
                            name="nextServiceRPM"
                            rules={[{ type: 'number', min: 0 }]}
                            style={{ marginBottom: '2px' }}
                          >
                            <InputNumber
                              size="small"
                              className="w-full"
                              min={0}
                              step={0.1}
                              precision={2}
                              placeholder="0.00"
                              style={{ width: '100%', fontSize: '11px' }}
                              controls={false}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    );
                  }
                  return null;
                }}
              </Form.Item>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                <Button 
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    form.resetFields();
                  }} 
                  size="small" 
                  style={{ height: '28px', fontSize: '11px' }}
                >
                  Cancel
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  size="small"
                  loading={submitting}
                  disabled={submitting}
                  style={{ height: '28px', fontSize: '11px' }}
                >
                  {editingId ? "Update Item" : "Save Item"}
                </Button>
              </div>
            </div>
          </Form>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-2" bodyStyle={{ padding: '8px' }}>
        <Row gutter={8} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input.Search
              placeholder="Search by item name or part number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              value={canBeFittedFilter}
              onChange={setCanBeFittedFilter}
              size="small"
              className="w-full"
            >
              <Select.Option value="all">All Items</Select.Option>
              <Select.Option value="true">Fittable Items</Select.Option>
              <Select.Option value="false">Non-Fittable Items</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={4} md={2}>
            <Button
              onClick={() => {
                setSearchTerm('');
                setCanBeFittedFilter('all');
              }}
              disabled={!searchTerm && canBeFittedFilter === 'all'}
              size="small"
              className="w-full"
            >
              Clear
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={items || []}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`
        }}
        onChange={handleTableChange}
      />
    </div>
  );
};

export default ItemManagement;