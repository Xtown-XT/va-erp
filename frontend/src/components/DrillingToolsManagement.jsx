import React, { useState, useEffect } from "react";
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    Popconfirm,
    message,
    Card,
    Space,
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import api from "../service/api";

const DrillingToolsManagement = () => {
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingTool, setEditingTool] = useState(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState("");

    const fetchTools = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/drilling-tools');
            if (response.data.success) {
                setTools(response.data.data);
            }
        } catch (error) {
            message.error("Failed to fetch drilling tools");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTools();
    }, []);

    const handleAdd = () => {
        setEditingTool(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (record) => {
        setEditingTool(record);
        form.setFieldsValue(record);
        setIsModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/drilling-tools/${id}`);
            message.success("Tool deleted successfully");
            fetchTools();
        } catch (error) {
            message.error("Failed to delete tool");
        }
    };

    const handleModalFinish = async (values) => {
        setSubmitting(true);
        try {
            console.log('Submitting drilling tool:', values);
            if (editingTool) {
                await api.put(`/api/drilling-tools/${editingTool.id}`, values);
                message.success("Tool updated successfully");
            } else {
                await api.post('/api/drilling-tools', values);
                message.success("Tool added successfully");
            }
            setIsModalVisible(false);
            form.resetFields();
            setEditingTool(null);
            fetchTools();
        } catch (error) {
            console.error('Error:', error.response?.data || error);
            message.error(error.response?.data?.message || "Operation failed");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredTools = tools.filter((tool) =>
        tool.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (tool.partNumber && tool.partNumber.toLowerCase().includes(searchText.toLowerCase()))
    );

    const [instanceModalVisible, setInstanceModalVisible] = useState(false);
    const [selectedToolForInstance, setSelectedToolForInstance] = useState(null);

    const handleAddInstance = (record) => {
        setSelectedToolForInstance(record);
        form.resetFields();
        setInstanceModalVisible(true);
    };

    const handleInstanceSubmit = async (values) => {
        setSubmitting(true);
        try {
            await api.post('/api/drilling-tools/instances', {
                ...values,
                drillingToolId: selectedToolForInstance.id
            });
            message.success("Instance added successfully");
            setInstanceModalVisible(false);
            form.resetFields();
            // Refetch tools or just show success? Instances might not show in main table.
            // Ideally we should list instances.
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to add instance");
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            sorter: (a, b) => a.name.localeCompare(b.name),
        },
        {
            title: "Part Number",
            dataIndex: "partNumber",
            key: "partNumber",
        },
        {
            title: "Category",
            dataIndex: "category",
            key: "category",
        },
        {
            title: "Total RPM",
            dataIndex: "totalRPM",
            key: "totalRPM",
        },
        {
            title: "Total Meter",
            dataIndex: "totalMeter",
            key: "totalMeter",
        },
        {
            title: "Base Price",
            dataIndex: "price",
            key: "price",
            render: (price) => `₹${price || 0}`,
        },
        {
            title: "Actions",
            key: "actions",
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        size="small"
                    />
                    <Popconfirm
                        title="Are you sure?"
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="p-4">
            <Card title="Drilling Tools" extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    Add Tool Type
                </Button>
            }>
                <div className="flex justify-between mb-4">
                    <Input
                        placeholder="Search by name or part number"
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                    />
                </div>
                <Table
                    columns={columns}
                    dataSource={filteredTools}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 50 }}
                />
            </Card>

            <Modal
                title={editingTool ? "Edit Tool" : "Add Tool"}
                open={isModalVisible}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                    setEditingTool(null);
                }}
                confirmLoading={submitting}
                onOk={() => form.submit()}
                okText="Submit"
                cancelText="Cancel"
            >
                <Form form={form} layout="vertical" onFinish={handleModalFinish}>
                    <Form.Item
                        name="name"
                        label="Tool Name"
                        rules={[{ required: true, message: "Please enter tool name" }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item name="partNumber" label="Part Number">
                        <Input />
                    </Form.Item>

                    <Form.Item name="category" label="Category">
                        <Input />
                    </Form.Item>

                    <div className="flex gap-4">
                        <Form.Item name="totalRPM" label="Total RPM" className="flex-1">
                            <InputNumber style={{ width: "100%" }} min={0} />
                        </Form.Item>

                        <Form.Item name="totalMeter" label="Total Meter" className="flex-1">
                            <InputNumber style={{ width: "100%" }} min={0} />
                        </Form.Item>
                    </div>

                    <Form.Item name="price" label="Base Price">
                        <InputNumber style={{ width: "100%" }} min={0} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={`Add Instance for ${selectedToolForInstance?.name}`}
                open={instanceModalVisible}
                onCancel={() => {
                    setInstanceModalVisible(false);
                    form.resetFields();
                }}
                confirmLoading={submitting}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleInstanceSubmit}>
                    <Form.Item
                        name="serialNumber"
                        label="Serial Number"
                        rules={[{ required: true, message: "Required" }]}
                    >
                        <Input placeholder="e.g. SN-001" />
                    </Form.Item>
                    <Form.Item name="initialRPM" label="Initial RPM (Optional)">
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="initialMeter" label="Initial Meter (Optional)">
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default DrillingToolsManagement;
