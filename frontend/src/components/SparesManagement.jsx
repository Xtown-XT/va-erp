import React, { useState, useEffect } from "react";
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    InputNumber,
    Popconfirm,
    message,
    Card,
    Space,
    Tag,
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import axios from "axios";
import api from "../service/api";
import { getAuthHeader } from "../service/auth";

const { Option } = Select;

const SparesManagement = () => {
    const [spares, setSpares] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingSpare, setEditingSpare] = useState(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState("");

    const fetchSpares = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/spares');
            if (response.data.success) {
                setSpares(response.data.data);
            }
        } catch (error) {
            message.error("Failed to fetch spares");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSpares();
    }, []);

    const handleAdd = () => {
        setEditingSpare(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (record) => {
        setEditingSpare(record);
        form.setFieldsValue(record);
        setIsModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/spares/${id}`);
            message.success("Spare deleted successfully");
            fetchSpares();
        } catch (error) {
            message.error("Failed to delete spare");
        }
    };

    const handleModalFinish = async (values) => {
        try {
            if (editingSpare) {
                await api.put(`/api/spares/${editingSpare.id}`, values);
                message.success("Spare updated successfully");
            } else {
                await api.post('/api/spares', values);
                message.success("Spare added successfully");
            }
            setIsModalVisible(false);
            fetchSpares();
        } catch (error) {
            message.error("Operation failed");
        }
    };

    const filteredSpares = spares.filter((spare) =>
        spare.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (spare.partNumber && spare.partNumber.toLowerCase().includes(searchText.toLowerCase()))
    );

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
            title: "Type",
            dataIndex: "spareType",
            key: "spareType",
            render: (type) => (
                type ? <Tag color={type === 'machine' ? 'blue' : 'green'}>{type.toUpperCase()}</Tag> : '-'
            )
        },
        {
            title: "Units",
            dataIndex: "units",
            key: "units",
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
            <Card title="Spares Management" extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    Add Spare
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
                    dataSource={filteredSpares}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title={editingSpare ? "Edit Spare" : "Add Spare"}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={form.submit}
            >
                <Form form={form} layout="vertical" onFinish={handleModalFinish}>
                    <Form.Item
                        name="name"
                        label="Spare Name"
                        rules={[{ required: true, message: "Please enter spare name" }]}
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
                        <Form.Item name="spareType" label="Type" className="flex-1">
                            <Select allowClear>
                                <Option value="machine">Machine</Option>
                                <Option value="compressor">Compressor</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="units" label="Units" className="flex-1">
                            <Select allowClear>
                                {['kg', 'litre', 'meters', 'nos', 'set', 'unit', 'kit'].map(u => (
                                    <Option key={u} value={u}>{u}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </div>

                    <Form.Item name="price" label="Base Price">
                        <InputNumber style={{ width: "100%" }} min={0} />
                    </Form.Item>
                </Form>
            </Modal>
        </div >
    );
};

export default SparesManagement;
