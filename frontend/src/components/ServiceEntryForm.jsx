import React, { useState, useEffect } from "react";
import {
    Modal,
    Form,
    Input,
    Select,
    InputNumber,
    DatePicker,
    Button,
    Table,
    Space,
    Typography,
    message,
    Divider,
    Radio
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;

const ServiceEntryForm = ({ visible, onCancel, onSuccess, prefilledAsset }) => {
    const [form] = Form.useForm();
    const [items, setItems] = useState([]);

    // Data
    const [machines, setMachines] = useState([]);
    const [compressors, setCompressors] = useState([]);
    const [spares, setSpares] = useState([]);
    const [toolInstances, setToolInstances] = useState([]); // Available instances
    const [sites, setSites] = useState([]);

    const fetchData = async () => {
        try {
            const [machRes, compRes, spareRes, toolRes, siteRes] = await Promise.all([
                api.get('/api/machines'),
                api.get('/api/compressors'),
                api.get('/api/spares'),
                // Need an endpoint for *available* tool instances. For now, we might fetch all and filter or add specific endpoint.
                // Or use `drilling-tools/instances?status=In Stock` if implemented. 
                // Currently I didn't implement specialized instance fetch. 
                // I'll skip fetching instances for this iteration or assume all catalog for now? No, need instances.
                // Let's assume I need to fetch all sites to know where we are.
                api.get('/api/drilling-tools'), // This is catalog.
                api.get('/api/sites'),
            ]);

            if (machRes.data.success) setMachines(machRes.data.data);
            if (compRes.data.success) setCompressors(compRes.data.data);
            if (spareRes.data.success) setSpares(spareRes.data.data);
            if (siteRes.data.success) setSites(siteRes.data.data);

            // For instances, we really need a way to select specific Serial No. 
            // I'll fallback to manually entering/selecting? 
            // I should add an endpoint to fetch drilling tool instances in next turn or quick fix.
            // For now, I will simulate instance selection by generic catalog + serial input? 
            // Better: Just use Catalog for now and let Backend handle creating/finding instance? 
            // NO, Backend expects `itemId` to be Instance ID for tools.
            // I MUST fetch instances.
            // I'll do a quick fetch of site stock and extract instances? 
            // Or just add `api/drilling-tools/instances/available` endpoint.

        } catch (error) {
            console.error(error);
        }
    };

    // fetch instances separately since I missed endpoint
    const fetchInstances = async () => {
        try {
            // We want "In Stock" instances, preferably at the selected Site?
            // For now fetch all available
            const res = await api.get('/api/drilling-tools/instances?status=In Stock');
            if (res.data.success) setToolInstances(res.data.data);
        } catch (e) {
            console.error("Failed to fetch instances", e);
        }
    };

    useEffect(() => {
        fetchInstances();
    }, [visible]);

    useEffect(() => {
        if (visible) fetchData();
    }, [visible]);


    // Item Sub-Form
    const [itemForm] = Form.useForm();

    const addItem = (values) => {
        const newItem = {
            ...values,
            itemName: values.itemType === 'spare'
                ? spares.find(s => s.id === values.itemId)?.name
                : "Tool Instance " + values.itemId, // Ideally show name + serial
            key: Date.now(),
        };
        setItems([...items, newItem]);
    };

    const removeItem = (key) => {
        setItems(items.filter(i => i.key !== key));
    };

    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();

            const payload = {
                machineId: values.assetType === 'machine' ? values.assetId : null,
                compressorId: values.assetType === 'compressor' ? values.assetId : null,
                serviceDate: values.serviceDate,
                serviceName: values.serviceName,
                serviceType: values.serviceType,
                // remarks: values.remarks, 
                currentRpm: values.currentRpm,
                siteId: values.siteId,
                usedItems: items.map(i => ({
                    itemType: i.itemType,
                    itemId: i.itemId,
                    quantity: i.quantity
                }))
            };

            await api.post(
                '/api/service/entry',
                payload
            );
            message.success("Service Entry Saved Successfully");
            onSuccess();
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to save service entry");
        } finally {
            setLoading(false);
        }
    };

    // Quick Fix for Tool Selection:
    // Since I don't have an endpoint for instances, I will disable Tool selection 
    // or just allow Spares for now, and note this gap.
    // OR I can use the `spares` endpoint which returns spares.

    // I will enable SPARES ONLY for this version to ensure stability, 
    // unless I add the route quickly. which I should.
    // I'll add `getAvailableInstances` to `drillingTools` module in next step.
    // For now, I'll restrict to Spares.

    const columns = [
        { title: "Type", dataIndex: "itemType" },
        { title: "Item", dataIndex: "itemName" },
        { title: "Qty", dataIndex: "quantity" },
        { title: "Action", render: (_, r) => <Button danger icon={<DeleteOutlined />} onClick={() => removeItem(r.key)} /> }
    ];

    return (
        <Modal
            title="Service Entry"
            open={visible}
            onCancel={onCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            width={800}
        >
            <Form form={form} layout="vertical">
                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name="assetType" label="Asset Type" initialValue="machine">
                        <Radio.Group>
                            <Radio value="machine">Machine</Radio>
                            <Radio value="compressor">Compressor</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, curr) => prev.assetType !== curr.assetType}
                    >
                        {({ getFieldValue }) =>
                            getFieldValue('assetType') === 'machine' ? (
                                <Form.Item name="assetId" label="Select Machine" rules={[{ required: true }]}>
                                    <Select showSearch optionFilterProp="children">
                                        {machines.map(m => <Option key={m.id} value={m.id}>{m.machineNumber}</Option>)}
                                    </Select>
                                </Form.Item>
                            ) : (
                                <Form.Item name="assetId" label="Select Compressor" rules={[{ required: true }]}>
                                    <Select showSearch optionFilterProp="children">
                                        {compressors.map(c => <Option key={c.id} value={c.id}>{c.compressorName}</Option>)}
                                    </Select>
                                </Form.Item>
                            )
                        }
                    </Form.Item>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name="serviceDate" label="Date" initialValue={dayjs()} rules={[{ required: true }]}>
                        <DatePicker className="w-full" />
                    </Form.Item>
                    <Form.Item name="siteId" label="Site (Location)" rules={[{ required: true }]}>
                        <Select showSearch optionFilterProp="children">
                            {sites.map(s => <Option key={s.id} value={s.id}>{s.siteName}</Option>)}
                        </Select>
                    </Form.Item>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name="serviceName" label="Service Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="serviceType" label="Type" initialValue="Machine Service">
                        <Select>
                            <Option value="Machine Service">Machine Service</Option>
                            <Option value="Compressor Service">Compressor Service</Option>
                            <Option value="Engine Service">Engine Service</Option>
                            <Option value="Other">Other</Option>
                        </Select>
                    </Form.Item>
                </div>

                <Form.Item name="currentRpm" label="Current RPM/Reading">
                    <InputNumber style={{ width: '100%' }} />
                </Form.Item>
            </Form>

            <Divider>Used Items</Divider>

            <div className="bg-gray-50 p-4 rounded mb-4">
                <Form form={itemForm} layout="inline">
                    <Form.Item name="itemType" initialValue="spare" style={{ width: 100 }}>
                        <Select onChange={() => itemForm.setFieldsValue({ itemId: null, quantity: 1 })}>
                            <Option value="spare">Spare</Option>
                            <Option value="drillingTool">Tool</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="itemId" style={{ width: 250 }} rules={[{ required: true }]}>
                        <Select placeholder="Select Item" showSearch optionFilterProp="children">
                            {
                                Form.useWatch('itemType', itemForm) === 'spare'
                                    ? spares.map(s => <Option key={s.id} value={s.id}>{s.name} ({s.partNumber})</Option>)
                                    : toolInstances.map(t => <Option key={t.id} value={t.id}>
                                        {t.catalogItem?.name} (Serial: {t.serialNumber || 'N/A'}) - {t.status}
                                    </Option>)
                            }
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="quantity"
                        style={{ width: 100 }}
                        rules={[{ required: true }]}
                        initialValue={1}
                    >
                        <InputNumber min={1} placeholder="Qty" />
                    </Form.Item>
                    <Button type="dashed" onClick={() => {
                        itemForm.validateFields().then(values => {
                            addItem(values);
                            itemForm.resetFields(['itemId', 'quantity']);
                        });
                    }} icon={<PlusOutlined />}>Add</Button>
                </Form>
            </div>

            <Table columns={columns} dataSource={items} pagination={false} size="small" />

        </Modal>
    );
};

export default ServiceEntryForm;
