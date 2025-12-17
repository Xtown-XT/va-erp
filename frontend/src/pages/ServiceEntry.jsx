import React, { useState, useEffect } from 'react';
import { Card, Form, Select, Button, Input, DatePicker, Row, Col, Typography, message, Table, InputNumber, Divider, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../service/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ServiceEntry = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Data States
    const [sites, setSites] = useState([]);
    const [machines, setMachines] = useState([]);
    const [compressors, setCompressors] = useState([]);
    const [spares, setSpares] = useState([]); // All spares or filtered
    const [serviceItems, setServiceItems] = useState([]); // Added items

    // Selection States
    const [selectedSiteId, setSelectedSiteId] = useState(null);
    const [assetType, setAssetType] = useState('machine'); // 'machine' or 'compressor'
    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [assetDetails, setAssetDetails] = useState(null); // { currentRPM, nextServiceRPM, ... }

    // Initial Data Fetch
    useEffect(() => {
        fetchSites();
        fetchSpares();
    }, []);

    const fetchSites = async () => {
        try {
            const res = await api.get('/api/sites?limit=1000');
            if (res.data.success) setSites(res.data.data);
        } catch (error) {
            console.error("Error fetching sites:", error);
        }
    };

    const fetchSpares = async () => {
        try {
            const res = await api.get('/api/spares?limit=1000'); // Assuming global list needed for selector
            if (res.data.success) setSpares(res.data.data);
        } catch (error) {
            console.error("Error fetching spares:", error);
        }
    };

    // Fetch Assets based on Site
    useEffect(() => {
        if (selectedSiteId) {
            fetchAssets(selectedSiteId);
        } else {
            setMachines([]);
            setCompressors([]);
        }
    }, [selectedSiteId]);

    const fetchAssets = async (siteId) => {
        setLoading(true);
        try {
            // Fetch Machines
            const mRes = await api.get(`/api/machines?siteId=${siteId}`);
            if (mRes.data.success) setMachines(mRes.data.data);

            // Fetch Compressors
            const cRes = await api.get(`/api/compressors?siteId=${siteId}`);
            if (cRes.data.success) setCompressors(cRes.data.data);
        } catch (error) {
            message.error("Failed to load assets");
        } finally {
            setLoading(false);
        }
    };

    // Handle Asset Selection to show Service Info
    const handleAssetChange = (id) => {
        setSelectedAssetId(id);
        let asset = null;
        if (assetType === 'machine') {
            asset = machines.find(m => m.id === id);
        } else {
            asset = compressors.find(c => c.id === id);
        }

        if (asset) {
            setAssetDetails({
                currentRPM: assetType === 'machine' ? asset.machineRPM : asset.compressorRPM,
                nextServiceRPM: assetType === 'machine' ? asset.nextServiceRPM : asset.nextServiceRPM, // Default to service cycle
                serviceCycle: assetType === 'machine' ? asset.serviceCycleRpm : asset.serviceCycleRpm,
                name: assetType === 'machine' ? asset.machineNumber : asset.compressorName
            });
            // Auto-fill current RPM in form
            form.setFieldsValue({
                currentRpm: assetType === 'machine' ? asset.machineRPM : asset.compressorRPM
            });
        } else {
            setAssetDetails(null);
        }
    };

    // Add Spare to List
    const handleAddSpare = (values) => {
        const spare = spares.find(s => s.id === values.spareId);
        if (!spare) return;

        if (values.quantity > (spare.currentStock || 1000)) { // Assuming client-side stock check might be limited
            // Optional warning
        }

        const newItem = {
            id: Date.now(),
            itemId: spare.id,
            itemName: spare.name,
            partNumber: spare.partNumber,
            itemType: 'spare',
            quantity: values.quantity
        };

        setServiceItems([...serviceItems, newItem]);
    };

    const handleRemoveItem = (id) => {
        setServiceItems(serviceItems.filter(i => i.id !== id));
    };

    const handleSubmit = async (values) => {
        if (!selectedSiteId || !selectedAssetId) {
            message.error("Please select a site and asset");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                siteId: selectedSiteId,
                serviceDate: values.date.format('YYYY-MM-DD'),
                machineId: assetType === 'machine' ? selectedAssetId : null,
                compressorId: assetType === 'compressor' ? selectedAssetId : null,
                serviceName: values.serviceName,
                serviceType: values.serviceType || (assetType === 'machine' ? 'Machine Service' : 'Compressor Service'),
                currentRpm: values.currentRpm,
                // remarks: values.remarks,
                usedItems: serviceItems.map(item => ({
                    itemType: item.itemType,
                    itemId: item.itemId,
                    quantity: item.quantity
                }))
            };

            const res = await api.post('/api/service', payload);
            if (res.data.success) {
                message.success("Service Entry Created Successfully");
                form.resetFields();
                setServiceItems([]);
                setAssetDetails(null);
                setSelectedAssetId(null);
                // Refresh assets to get updated RPM cycles
                if (selectedSiteId) fetchAssets(selectedSiteId);
            }
        } catch (error) {
            console.error(error);
            message.error(error.response?.data?.message || "Failed to create service entry");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-4">
            <Card title="Service Entry" extra={<span className="text-gray-500">Log Maintenance & Services</span>}>
                <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ date: dayjs() }}>

                    {/* 1. Selection Section */}
                    <div className="bg-gray-50 p-4 rounded mb-4">
                        <Row gutter={16}>
                            <Col span={6}>
                                <Form.Item label="Site" name="siteId" required>
                                    <Select
                                        placeholder="Select Site"
                                        onChange={(val) => {
                                            setSelectedSiteId(val);
                                            setSelectedAssetId(null);
                                            setAssetDetails(null);
                                            form.setFieldsValue({ siteId: val }); // ensure form state
                                        }}
                                    >
                                        {sites.map(s => <Option key={s.id} value={s.id}>{s.siteName}</Option>)}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item label="Asset Type">
                                    <Select value={assetType} onChange={(val) => {
                                        setAssetType(val);
                                        setSelectedAssetId(null);
                                        setAssetDetails(null);
                                    }}>
                                        <Option value="machine">Machine</Option>
                                        <Option value="compressor">Compressor</Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item label={assetType === 'machine' ? "Select Machine" : "Select Compressor"} required>
                                    <Select
                                        value={selectedAssetId}
                                        onChange={handleAssetChange}
                                        disabled={!selectedSiteId}
                                        placeholder={!selectedSiteId ? "Select Site First" : "Select Asset"}
                                    >
                                        {assetType === 'machine'
                                            ? machines.map(m => <Option key={m.id} value={m.id}>{m.machineNumber}</Option>)
                                            : compressors.map(c => <Option key={c.id} value={c.id}>{c.compressorName}</Option>)
                                        }
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>

                        {/* Asset Details Preview */}
                        {assetDetails && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Text strong>Current RPM:</Text> {assetDetails.currentRPM || 0}
                                    </Col>
                                    <Col span={8}>
                                        <Text strong>Next Service Due:</Text> <span className="text-red-600 font-bold">{assetDetails.nextServiceRPM || 'Not Set'}</span>
                                    </Col>
                                    <Col span={8}>
                                        <Text strong>Cycle:</Text> {assetDetails.serviceCycle || 250} RPM
                                    </Col>
                                </Row>
                            </div>
                        )}
                    </div>

                    {/* 2. Service Details */}
                    <Divider orientation="left">Service Details</Divider>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item label="Service Date" name="date" rules={[{ required: true }]}>
                                <DatePicker className="w-full" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="Service Name" name="serviceName" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        {assetType === 'compressor' && (
                            <Col span={6}>
                                <Form.Item label="Service Type" name="serviceType" initialValue="Compressor Service">
                                    <Select>
                                        <Option value="Compressor Service">Compressor Service</Option>
                                        <Option value="Engine Service">Engine Service</Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                        )}
                        <Col span={6}>
                            <Form.Item label="RPM at Service" name="currentRpm" rules={[{ required: true }]}>
                                <InputNumber className="w-full" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={24}>
                            {/* Remarks removed */}
                        </Col>
                    </Row>

                    {/* 3. Parts Used */}
                    <Divider orientation="left">Spares Consumed</Divider>
                    <div className="bg-gray-50 p-4 rounded mb-6">
                        <Row gutter={8} align="bottom">
                            <Col span={10}>
                                <p className="mb-1 text-xs font-semibold">Select Spare</p>
                                <Select
                                    showSearch
                                    placeholder="Search Spare"
                                    style={{ width: '100%' }}
                                    onChange={(val) => {
                                        // Temporary state for the adder
                                        form.setFieldValue('tempSpareId', val);
                                    }}
                                    filterOption={(input, option) =>
                                        option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                    }
                                >
                                    {spares.map(s => (
                                        <Option key={s.id} value={s.id}>{s.name} ({s.partNumber})</Option>
                                    ))}
                                </Select>
                            </Col>
                            <Col span={4}>
                                <p className="mb-1 text-xs font-semibold">Quantity</p>
                                <InputNumber
                                    min={1}
                                    defaultValue={1}
                                    style={{ width: '100%' }}
                                    onChange={val => form.setFieldValue('tempQty', val)}
                                />
                            </Col>
                            <Col span={4}>
                                <Button type="dashed" icon={<PlusOutlined />} onClick={() => {
                                    const sid = form.getFieldValue('tempSpareId');
                                    const qty = form.getFieldValue('tempQty') || 1;
                                    if (sid) handleAddSpare({ spareId: sid, quantity: qty });
                                }}>Add</Button>
                            </Col>
                        </Row>

                        {/* List of Added Items */}
                        {serviceItems.length > 0 && (
                            <Table
                                className="mt-4"
                                dataSource={serviceItems}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                columns={[
                                    { title: 'Item', dataIndex: 'itemName' },
                                    { title: 'Part No.', dataIndex: 'partNumber' },
                                    { title: 'Qty', dataIndex: 'quantity' },
                                    {
                                        title: 'Action',
                                        key: 'action',
                                        render: (_, record) => (
                                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(record.id)} />
                                        )
                                    }
                                ]}
                            />
                        )}
                    </div>

                    <div className="flex justify-end gap-4">
                        <Button size="large">Cancel</Button>
                        <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />} loading={submitting}>
                            Submit Service Entry
                        </Button>
                    </div>

                </Form>
            </Card>
        </div>
    );
};

export default ServiceEntry;
