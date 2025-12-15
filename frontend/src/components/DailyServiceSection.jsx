import React from "react";
import { Form, Button, Select, InputNumber, Row, Col, Card } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useItemsByType, useSiteStock } from "../hooks/useQueries";

const DailyServiceSection = ({ machines, compressor, form, siteId }) => {
    // Determine assets available for service
    // Must call hooks at top level
    const watchedMachineId = Form.useWatch('machineId', form);
    const watchedCompressorId = Form.useWatch('compressorId', form);

    const { data: stockData } = useSiteStock(siteId);
    const spares = stockData?.spares || [];

    const machine = machines.find(m => m.id === watchedMachineId);

    // Helper to safely parse config
    const getSafeConfig = (config) => {
        if (!config) return [];
        if (Array.isArray(config)) return config;
        if (typeof config === 'string') {
            try { return JSON.parse(config); } catch (e) { return []; }
        }
        return [];
    };

    const machineConfig = getSafeConfig(machine?.maintenanceConfig);
    const compressorConfig = getSafeConfig(compressor?.maintenanceConfig);

    const assetOptions = [];
    if (machine) assetOptions.push({ label: `Machine: ${machine.machineNumber}`, value: `MACHINE:${machine.id}` });
    if (compressor) assetOptions.push({ label: `Comp: ${compressor.compressorName}`, value: `COMPRESSOR:${compressor.id}` });

    return (
        <Card title="Maintenance & Services" size="small" style={{ marginTop: 20 }}>
            <Form.List name="services">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name, ...restField }) => (
                            <Card key={key} size="small" className="mb-2 bg-gray-50">
                                <Row gutter={16}>
                                    <Col span={6}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'assetKey']}
                                            label="Service For"
                                            rules={[{ required: true }]}
                                        >
                                            <Select options={assetOptions} placeholder="Select Target" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item
                                            noStyle
                                            shouldUpdate={(prevValues, curValues) =>
                                                prevValues.services?.[name]?.assetKey !== curValues.services?.[name]?.assetKey
                                            }
                                        >
                                            {() => {
                                                const assetKey = form.getFieldValue(['services', name, 'assetKey']);
                                                let configOptions = [];

                                                if (assetKey?.startsWith('MACHINE')) {
                                                    if (assetKey.includes(`:${machine?.id}`)) {
                                                        configOptions = machineConfig;
                                                    }
                                                } else if (assetKey?.startsWith('COMPRESSOR')) {
                                                    if (assetKey.includes(`:${compressor?.id}`)) {
                                                        configOptions = compressorConfig;
                                                    }
                                                }

                                                return (
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, 'serviceName']}
                                                        label="Service Name"
                                                        rules={[{ required: true, message: 'Select a Service' }]}
                                                    >
                                                        <Select
                                                            placeholder="Select Service"
                                                        >
                                                            {configOptions.map(c => (
                                                                <Select.Option key={c.name} value={c.name}>{c.name}</Select.Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>
                                                );
                                            }}
                                        </Form.Item>
                                    </Col>

                                    <Col span={2}>
                                        <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} style={{ marginTop: 30 }} />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col span={24}>
                                        <Form.Item
                                            noStyle
                                            shouldUpdate={(prev, cur) => prev.services?.[name]?.assetKey !== cur.services?.[name]?.assetKey}
                                        >
                                            {() => {
                                                const assetKey = form.getFieldValue(['services', name, 'assetKey']);
                                                let targetType = null;
                                                if (assetKey?.startsWith('MACHINE')) targetType = 'machine';
                                                else if (assetKey?.startsWith('COMPRESSOR')) targetType = 'compressor';

                                                const filteredSpares = spares.filter(s => {
                                                    if (!s.type) return true; // Show general spares
                                                    return s.type === targetType;
                                                });

                                                return (
                                                    <Form.Item label="Spares Used">
                                                        <Form.List name={[name, 'spares']}>
                                                            {(spareFields, { add: addSpare, remove: removeSpare }) => (
                                                                <>
                                                                    {spareFields.map(({ key: sKey, name: sName, ...sRest }) => (
                                                                        <Row key={sKey} gutter={8} className="mb-1">
                                                                            <Col span={10}>
                                                                                <Form.Item {...sRest} name={[sName, 'itemId']} noStyle rules={[{ required: true }]}>
                                                                                    <Select placeholder="Spare" showSearch optionFilterProp="children">
                                                                                        {filteredSpares.map(s => (
                                                                                            <Select.Option key={s.id} value={s.spareId} disabled={s.quantity <= 0}>
                                                                                                {s.name} (Stock: {s.quantity})
                                                                                            </Select.Option>
                                                                                        ))}
                                                                                    </Select>
                                                                                </Form.Item>
                                                                            </Col>
                                                                            <Col span={4}>
                                                                                <Form.Item {...sRest} name={[sName, 'quantity']} noStyle rules={[{ required: true }]}>
                                                                                    <InputNumber placeholder="Qty" min={1} />
                                                                                </Form.Item>
                                                                            </Col>
                                                                            <Col span={2}>
                                                                                <DeleteOutlined onClick={() => removeSpare(sName)} className="text-red-500 cursor-pointer" />
                                                                            </Col>
                                                                        </Row>
                                                                    ))}
                                                                    <Button type="dashed" size="small" onClick={() => addSpare()} icon={<PlusOutlined />}>Add Spare</Button>
                                                                </>
                                                            )}
                                                        </Form.List>
                                                    </Form.Item>
                                                );
                                            }}
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Card>
                        ))}
                        <Button type="dashed" onClick={() => add({ assetKey: machine ? `MACHINE:${machine.id}` : undefined })} block icon={<PlusOutlined />}>
                            Add Service Record
                        </Button>
                    </>
                )}
            </Form.List>
        </Card>
    );
};

export default DailyServiceSection;
