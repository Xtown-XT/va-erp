import React from "react";
import { Form, Button, Select, InputNumber, Row, Col, Card } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useItemsByType } from "../hooks/useQueries";

const DailyServiceSection = ({ machines, compressor, form, siteId }) => {
    // Determine assets available for service
    // Must call hooks at top level
    const watchedMachineId = Form.useWatch('machineId', form);
    const watchedCompressorId = Form.useWatch('compressorId', form);

    const machine = machines.find(m => m.id === watchedMachineId);
    const compressorId = watchedCompressorId || machine?.compressorId;

    // Fetch spares with stock for the selected site
    const { data: spares = [] } = useItemsByType('spare', siteId);

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
                                            {...restField}
                                            name={[name, 'serviceName']}
                                            label="Service Name"
                                            rules={[{ required: true }]}
                                        >
                                            <Select mode="tags" placeholder="Service Name" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={4}>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'currentRpm']}
                                            label="Current RPM"
                                        >
                                            <InputNumber className="w-full" placeholder="Auto" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={2}>
                                        <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} style={{ marginTop: 30 }} />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col span={24}>
                                        <Form.Item label="Spares Used">
                                            <Form.List name={[name, 'spares']}>
                                                {(spareFields, { add: addSpare, remove: removeSpare }) => (
                                                    <>
                                                        {spareFields.map(({ key: sKey, name: sName, ...sRest }) => (
                                                            <Row key={sKey} gutter={8} className="mb-1">
                                                                <Col span={10}>
                                                                    <Form.Item {...sRest} name={[sName, 'itemId']} noStyle rules={[{ required: true }]}>
                                                                        <Select placeholder="Spare" showSearch optionFilterProp="children">
                                                                            {spares.map(s => (
                                                                                <Select.Option key={s.id} value={s.id} disabled={s.balance <= 0}>
                                                                                    {s.itemName} (Stock: {s.balance})
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
