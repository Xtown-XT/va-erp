import React, { useState, useEffect } from "react";
import { Modal, Tabs, Table, Button, Form, Input, InputNumber, Select, Alert, Tag, Space, message, ConfigProvider, Tooltip, Progress, Divider, Popconfirm, DatePicker } from "antd";
import { PlusOutlined, HistoryOutlined, ToolOutlined, DeleteOutlined, EditOutlined, SaveOutlined, WarningOutlined } from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";
import { canEdit } from "../service/auth";

const MaintenanceModal = ({ visible, onClose, asset, assetType, onSuccess, sites }) => {
    // assetType: 'machine' or 'compressor'
    const [activeTab, setActiveTab] = useState("1");
    const [config, setConfig] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [spares, setSpares] = useState([]);

    // Config Form
    const [editingConfig, setEditingConfig] = useState(null);
    const [configForm] = Form.useForm();
    const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);

    // Record Service Form
    const [recordForm] = Form.useForm();
    const [selectedService, setSelectedService] = useState(null);
    const [selectedSpares, setSelectedSpares] = useState([]); // [{ spareId, quantity, name }]

    const fetchMaintenanceStatus = async () => {
        if (!asset) return;
        setLoading(true);
        try {
            const res = await api.get(`/api/service/maintenance-status/${assetType}/${asset.id}`);
            setConfig(res.data.data);
        } catch (err) {
            console.error(err);
            message.error("Failed to fetch maintenance status");
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        if (!asset) return;
        try {
            const query = assetType === 'machine' ? `machineId=${asset.id}` : `compressorId=${asset.id}`;
            const res = await api.get(`/api/service/history?${query}`);
            setHistory(res.data.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSpares = async () => {
        try {
            const res = await api.get('/api/spares?limit=1000');
            setSpares(res.data.data || []);
        } catch (err) {
            console.error(err);
        }
    }

    useEffect(() => {
        if (visible && asset) {
            fetchMaintenanceStatus();
            fetchHistory();
            fetchSpares();
            setActiveTab("1");
            recordForm.resetFields();
            setSelectedSpares([]);
        }
    }, [visible, asset]);

    // --- Tab 1: Status & Config ---

    const handleSaveConfig = async (values) => {
        try {
            const endpoint = assetType === 'machine' ? `/api/machines/${asset.id}` : `/api/compressors/${asset.id}`;
            const { data } = await api.get(endpoint);
            const currentAsset = data.data;
            let rawConfig = currentAsset.maintenanceConfig || [];
            if (!Array.isArray(rawConfig)) rawConfig = [];

            const newConfigItem = {
                id: editingConfig?.id,
                name: values.name,
                cycle: parseInt(values.cycle),
                lastServiceRPM: parseInt(values.lastServiceRPM) || editingConfig?.lastServiceRPM || 0,
                alertThreshold: 50
            };

            if (editingConfig) {
                const index = rawConfig.findIndex(c => c.name === editingConfig.name);
                if (index >= 0) {
                    rawConfig[index] = { ...rawConfig[index], ...newConfigItem };
                }
            } else {
                if (rawConfig.find(c => c.name === values.name)) {
                    message.error("Service name already exists");
                    return;
                }
                rawConfig.push(newConfigItem);
            }

            await api.put(endpoint, { maintenanceConfig: rawConfig });
            message.success("Configuration saved");

            // Optimistic Update / Calculated Local State
            const currentRPM = assetType === 'machine' ? (asset.machineRPM || 0) : (asset.compressorRPM || 0);
            const calculatedItem = {
                ...newConfigItem,
                nextServiceRPM: (newConfigItem.lastServiceRPM || 0) + newConfigItem.cycle,
                status: 'OK', // Default, will be refreshed
                percentage: 0
            };

            // Re-calculate basic status for immediate display
            const remaining = calculatedItem.nextServiceRPM - currentRPM;
            calculatedItem.status = remaining <= 0 ? 'Overdue' : (remaining <= 50 ? 'Due Soon' : 'OK');
            calculatedItem.percentage = Math.min(100, Math.max(0, (remaining / calculatedItem.cycle) * 100));

            // Update local state
            if (editingConfig) {
                setConfig(prev => prev.map(c => c.name === editingConfig.name ? calculatedItem : c));
            } else {
                setConfig(prev => [...prev, calculatedItem]);
            }

            setIsConfigModalVisible(false);
            fetchMaintenanceStatus(); // Background refresh

        } catch (err) {
            console.error(err);
            message.error("Failed to save configuration");
        }
    };

    const handleDeleteConfig = async (serviceName) => {
        try {
            const endpoint = assetType === 'machine' ? `/api/machines/${asset.id}` : `/api/compressors/${asset.id}`;
            const { data } = await api.get(endpoint);
            const currentAsset = data.data;
            let rawConfig = currentAsset.maintenanceConfig || [];
            if (!Array.isArray(rawConfig)) rawConfig = [];

            const updatedConfig = rawConfig.filter(c => c.name !== serviceName);

            await api.put(endpoint, { maintenanceConfig: updatedConfig });
            message.success("Service type removed");
            fetchMaintenanceStatus();
        } catch (err) {
            console.error(err);
            message.error("Failed to delete");
        }
    }

    const columnsConfig = [
        {
            title: "Service Name",
            dataIndex: "name",
            key: "name",
            render: (text) => <span className="font-medium">{text}</span>
        },
        {
            title: "Cycle (RPM)",
            dataIndex: "cycle",
            key: "cycle"
        },
        {
            title: "Last Service",
            dataIndex: "lastServiceRPM",
            key: "lastServiceRPM",
            render: (val) => val || 0
        },
        {
            title: "Next Due",
            dataIndex: "nextServiceRPM",
            key: "nextServiceRPM",
            render: (val, record) => (
                <Space>
                    {val}
                    {record.status === 'Overdue' && <Tag color="red">Overdue</Tag>}
                    {record.status === 'Due Soon' && <Tag color="orange">Due Soon</Tag>}
                </Space>
            )
        },
        {
            title: "Health",
            key: "health",
            render: (_, record) => (
                <Progress percent={record.percentage} size="small" showInfo={false} status={record.status === 'Overdue' ? 'exception' : 'active'} strokeColor={record.status === 'Overdue' ? 'red' : (record.status === 'Due Soon' ? 'orange' : 'green')} />
            )
        },
        {
            title: "Action",
            key: "action",
            render: (_, record) => canEdit() && (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => {
                        setEditingConfig(record);
                        configForm.setFieldsValue(record);
                        setIsConfigModalVisible(true);
                    }} />
                    <Popconfirm title="Delete this service type?" onConfirm={() => handleDeleteConfig(record.name)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // --- Tab 2: Record Service ---

    const handleRecordSubmit = async (values) => {
        try {
            const payload = {
                machineId: assetType === 'machine' ? asset.id : null,
                compressorId: assetType === 'compressor' ? asset.id : null,
                serviceDate: values.date.format('YYYY-MM-DD'),
                serviceName: values.serviceName,
                // If it's a known service from config, get its name. If Adhoc, use "Adhoc Repair" etc
                // If user selected "Other", use custom name
                currentRpm: values.currentRpm,
                siteId: values.siteId, // User must select site? Or infer from machine? Machine has siteId.
                // Let's ask for Site in form as assets move.
                remarks: values.remarks,
                usedItems: selectedSpares.map(s => ({
                    itemType: 'spare',
                    itemId: s.spareId,
                    quantity: s.quantity
                }))
            };

            await api.post('/api/service', payload);
            message.success("Service recorded successfully");

            // Refresh
            fetchMaintenanceStatus();
            fetchHistory();
            recordForm.resetFields();
            setSelectedSpares([]);
            onSuccess(); // Notify parent to refresh list if needed
            setActiveTab("1"); // Go back to status

        } catch (err) {
            console.error(err);
            message.error(err.response?.data?.message || "Failed to record service");
        }
    };

    const addSpareRow = () => {
        setSelectedSpares([...selectedSpares, { id: Date.now(), spareId: null, quantity: 1 }]);
    };

    const removeSpareRow = (id) => {
        setSelectedSpares(selectedSpares.filter(s => s.id !== id));
    };

    const updateSpareRow = (id, field, value) => {
        const newSpares = selectedSpares.map(s => {
            if (s.id === id) {
                const updated = { ...s, [field]: value };
                if (field === 'spareId') {
                    const spare = spares.find(sp => sp.id === value);
                    updated.name = spare ? spare.name : '';
                }
                return updated;
            }
            return s;
        });
        setSelectedSpares(newSpares);
    };

    return (
        <Modal
            title={`Maintenance: ${asset?.machineNumber || asset?.compressorName} (${assetType})`}
            open={visible}
            onCancel={onClose}
            width={900}
            footer={null}
        >
            <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
                <Tabs.TabPane tab="Status & Configuration" key="1">
                    <div className="mb-4 flex justify-between">
                        <span className="text-gray-500">Manage service intervals and view current status.</span>
                        {canEdit() && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                setEditingConfig(null);
                                configForm.resetFields();
                                setIsConfigModalVisible(true);
                            }}>
                                Add Service Type
                            </Button>
                        )}
                    </div>
                    {config.length === 0 ? (
                        <Alert message="No service schedules configured. Add one to get started." type="info" showIcon />
                    ) : (
                        <Table dataSource={config} columns={columnsConfig} rowKey="name" pagination={false} size="small" />
                    )}
                </Tabs.TabPane>

                <Tabs.TabPane tab="Record Service" key="2">
                    <Form layout="vertical" form={recordForm} onFinish={handleRecordSubmit}>
                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item
                                name="serviceName"
                                label="Service Type"
                                rules={[{ required: true }]}
                            >
                                <Select
                                    placeholder="Select Service"
                                    onChange={(val) => {
                                        const conf = config.find(c => c.name === val);
                                        setSelectedService(conf);
                                    }}
                                >
                                    {config.map(c => (
                                        <Select.Option key={c.name} value={c.name}>
                                            {c.name} (Next: {c.nextServiceRPM})
                                        </Select.Option>
                                    ))}
                                    <Select.Option value="Ad-hoc Repair">Ad-hoc Repair / Breakdown</Select.Option>
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="date"
                                label="Date"
                                rules={[{ required: true }]}
                                initialValue={dayjs()}
                            >
                                <DatePicker className="w-full" />
                            </Form.Item>

                            <Form.Item
                                name="currentRpm"
                                label="Current RPM"
                                rules={[{ required: true }]}
                                help={selectedService ? `Last Service: ${selectedService.lastServiceRPM}` : ""}
                            >
                                <InputNumber className="w-full" step={1} />
                            </Form.Item>

                            <Form.Item name="siteId" label="Site" rules={[{ required: true }]} initialValue={asset?.siteId}>
                                <Select placeholder="Select Site" showSearch optionFilterProp="children">
                                    {sites?.map(s => (
                                        <Select.Option key={s.id} value={s.id}>{s.siteName}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </div>

                        <Form.Item name="remarks" label="Remarks">
                            <Input.TextArea rows={2} />
                        </Form.Item>

                        <Divider orientation="left">Spares Used</Divider>
                        {selectedSpares.map((row, index) => (
                            <div key={row.id} className="flex gap-2 mb-2 items-center">
                                <Select
                                    className="flex-1"
                                    placeholder="Select Spare"
                                    showSearch
                                    optionFilterProp="children"
                                    value={row.spareId}
                                    onChange={(val) => updateSpareRow(row.id, 'spareId', val)}
                                >
                                    {spares.map(s => (
                                        <Select.Option key={s.id} value={s.id}>{s.name} ({s.partNumber})</Select.Option>
                                    ))}
                                </Select>
                                <InputNumber
                                    min={1}
                                    value={row.quantity}
                                    onChange={(val) => updateSpareRow(row.id, 'quantity', val)}
                                    placeholder="Qty"
                                />
                                <Button danger icon={<DeleteOutlined />} onClick={() => removeSpareRow(row.id)} />
                            </div>
                        ))}
                        <Button type="dashed" onClick={addSpareRow} block icon={<PlusOutlined />}>
                            Add Spare
                        </Button>

                        <div className="mt-4 flex justify-end">
                            <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />}>
                                Record Service
                            </Button>
                        </div>
                    </Form>
                </Tabs.TabPane>

                <Tabs.TabPane tab="Usage History" key="3">
                    <Table
                        dataSource={history}
                        rowKey="id"
                        size="small"
                        columns={[
                            { title: "Date", dataIndex: "serviceDate", render: d => dayjs(d).format("DD/MM/YYYY") },
                            { title: "Service", dataIndex: "serviceName" },
                            { title: "RPM", dataIndex: "currentRpm" },
                            { title: "Spares", render: (_, r) => r.items?.map(i => `${i.spare?.name} (${i.quantity})`).join(", ") || "-" },
                            { title: "Remarks", dataIndex: "remarks" }
                        ]}
                    />
                </Tabs.TabPane>
            </Tabs>

            {/* Config Modal */}
            <Modal
                title={editingConfig ? "Edit Service Type" : "New Service Type"}
                open={isConfigModalVisible}
                onOk={configForm.submit}
                onCancel={() => setIsConfigModalVisible(false)}
            >
                <Form form={configForm} layout="vertical" onFinish={handleSaveConfig}>
                    <Form.Item name="name" label="Service Name" rules={[{ required: true }]}>
                        <Input placeholder="e.g. Hydraulic Oil Change" disabled={!!editingConfig} />
                    </Form.Item>
                    <Form.Item name="cycle" label="Cycle Interval (RPM)" rules={[{ required: true }]}>
                        <InputNumber className="w-full" min={50} step={50} />
                    </Form.Item>
                    <Form.Item name="lastServiceRPM" label="Last Service RPM (Initial)" tooltip="Set this to the current RPM if just starting, or actual last service value.">
                        <InputNumber className="w-full" min={0} />
                    </Form.Item>
                </Form>
            </Modal>
        </Modal>
    );
};

export default MaintenanceModal;
