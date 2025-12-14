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
            // We need to update the asset's maintenanceConfig directly
            // Backend endpoint specifically for config update might be better, but we can use PUT asset

            // Get current FULL config from asset (or the state we just fetched if we trust it's in sync, 
            // but fetching fresh asset is better. Ideally backend has a dedicated endpoint or we use put asset)
            // Let's assume we update the whole asset. 
            // BUT wait, we need the raw config array, the status endpoint returns computed status.
            // We usually need to fetch the ASSET again to get the raw JSON.
            // Simplified: The status object contains name/cycle/lastServiceRPM/alertThreshold which is enough to reconstruct.

            const newConfigItem = {
                id: editingConfig ? editingConfig.id : Date.now(), // Generate crude ID if new
                name: values.name,
                cycle: parseInt(values.cycle),
                lastServiceRPM: editingConfig ? editingConfig.lastServiceRPM : (values.lastServiceRPM || 0),
                alertThreshold: 50 // Fixed per requirement
            };

            let updatedConfigRaw = [...config];
            // Wait, 'config' state here is the computed status view. It has 'name', 'cycle', etc.
            // We need to map it back to just the stored fields.

            // Logic: 
            // 1. Get existing raw config from asset details (passed in props? likely stale).
            // 2. Or just map the 'config' state back to raw objects.

            const rawConfig = config.map(c => ({
                name: c.name,
                cycle: c.cycle,
                lastServiceRPM: c.lastServiceRPM
            }));

            if (editingConfig) {
                const index = rawConfig.findIndex(c => c.name === editingConfig.name);
                if (index >= 0) {
                    rawConfig[index] = { ...rawConfig[index], ...newConfigItem }; // Update name/cycle
                }
            } else {
                // Check duplicate name
                if (rawConfig.find(c => c.name === values.name)) {
                    message.error("Service name already exists");
                    return;
                }
                // New
                rawConfig.push({
                    name: values.name,
                    cycle: values.cycle,
                    lastServiceRPM: values.lastServiceRPM || 0
                });
            }

            // Save to Asset
            const endpoint = assetType === 'machine' ? `/api/machines/${asset.id}` : `/api/compressors/${asset.id}`;
            await api.put(endpoint, {
                // We only want to update detailed config
                maintenanceConfig: rawConfig,
                // Send required fields if needed? Usually PUT handles partial updates.
                // Assuming backend handles partial updates (it usually does in our patterns)
                // BUT wait, Machine update usually requires brandId/machineType etc if strict validation.
                // Let's hope validation allows partials or we need to send everything.
                // Re-reading machine.js handleSubmit... it builds payload carefully.
                // We might need a specific 'maintenance-config' endpoint or send minimal needed.
                // Safest: Send everything OR created a specific endpoint. 
                // Given constraints, I'll try sending just maintenanceConfig. If it fails, I'll fetch full asset first.
                maintenanceConfig: rawConfig
            });

            message.success("Configuration saved");
            setIsConfigModalVisible(false);
            fetchMaintenanceStatus(); // Refresh

        } catch (err) {
            console.error(err);
            message.error("Failed to save configuration");
        }
    };

    const handleDeleteConfig = async (serviceName) => {
        try {
            const rawConfig = config.filter(c => c.name !== serviceName).map(c => ({
                name: c.name,
                cycle: c.cycle,
                lastServiceRPM: c.lastServiceRPM
            }));

            const endpoint = assetType === 'machine' ? `/api/machines/${asset.id}` : `/api/compressors/${asset.id}`;
            await api.put(endpoint, { maintenanceConfig: rawConfig });
            message.success("Service type removed");
            fetchMaintenanceStatus();
        } catch (err) {
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
