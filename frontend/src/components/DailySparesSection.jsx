import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { Button, Card, Col, Form, InputNumber, Row, Select, Space, Typography, Table } from "antd";
import { useState, useEffect } from "react";
import { useAvailableItems, useItemsByType } from "../hooks/useQueries"; // Assuming hooks exist

const { Text } = Typography;

const DailySparesSection = ({ form, machines, compressor, siteId }) => {
    // We need to fetch spares (generic items)
    // Assuming useItemsByType('spare') or similar exists, or we use useAvailableItems but that might be for tools?
    // Let's use useItemsByType('spare', siteId) if possible to filter by site stock?
    // Existing DailyServiceSection likely uses something similar.

    // Implementation Note: reusing logic from DailyServiceSection regarding item selection would be ideal.
    // For now, let's assume we can fetch all spares.

    // Actually, we should probably just use the 'items' API with type=spare.
    // Let's try to find how DailyServiceSection does it.
    // ... (I recall seeing useItemsByType in hooks)

    const { data: spares = [] } = useItemsByType('spare', siteId);

    // We manage the list of "Spares consumption" generic entries.
    // Actually, we want to bind this to the Form so it submits with the main form.
    // Field name: `sparesConsumption` -> array of { entityType, entityId, spares: [] }

    // To make it simple UI:
    // "Changing Spares" Section
    // Rows: [Entity Select] [Spares Multi-Select/List]

    return (
        <Card title="Changing Spares (Direct Issue)" size="small" style={{ marginTop: 20 }}>
            <Form.List name="sparesConsumption">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name, ...restField }) => (
                            <Row key={key} gutter={16} style={{ marginBottom: 16, borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}>
                                <Col span={6}>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'entityKey']} // Composite key "TYPE:ID"
                                        label="Asset"
                                        rules={[{ required: true, message: 'Select Asset' }]}
                                    >
                                        <Select placeholder="Select Machine/Compressor">
                                            {/* List Main Machine */}
                                            {machines.filter(m => m.siteId === siteId).map(m => (
                                                <Select.Option key={`MACHINE:${m.id}`} value={`MACHINE:${m.id}`}>
                                                    Machine: {m.machineNumber}
                                                </Select.Option>
                                            ))}
                                            {/* List Compressor if available */}
                                            {compressor && (
                                                <Select.Option key={`COMPRESSOR:${compressor.id}`} value={`COMPRESSOR:${compressor.id}`}>
                                                    Compressor: {compressor.compressorName}
                                                </Select.Option>
                                            )}
                                        </Select>
                                    </Form.Item>
                                </Col>

                                <Col span={16}>
                                    <Form.Item label="Spares Used">
                                        <Form.List name={[name, 'spares']}>
                                            {(spareFields, { add: addSpare, remove: removeSpare }) => (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {spareFields.map(sf => (
                                                        <Space key={sf.key} align="baseline">
                                                            <Form.Item
                                                                {...sf}
                                                                name={[sf.name, 'itemId']}
                                                                rules={[{ required: true, message: 'Item' }]}
                                                                noStyle // compact
                                                            >
                                                                <Select
                                                                    style={{ width: 250 }}
                                                                    placeholder="Select Spare"
                                                                    showSearch
                                                                    filterOption={(input, option) =>
                                                                        (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                                                    }
                                                                >
                                                                    {spares.map(s => (
                                                                        <Select.Option key={s.id} value={s.id}>
                                                                            {s.itemName} ({s.partNumber})
                                                                        </Select.Option>
                                                                    ))}
                                                                </Select>
                                                            </Form.Item>
                                                            <Form.Item
                                                                {...sf}
                                                                name={[sf.name, 'quantity']}
                                                                rules={[{ required: true, message: 'Qty' }]}
                                                                initialValue={1}
                                                                noStyle
                                                            >
                                                                <InputNumber min={1} placeholder="Qty" style={{ width: 80 }} />
                                                            </Form.Item>
                                                            <Button
                                                                type="text"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                onClick={() => removeSpare(sf.name)}
                                                            />
                                                        </Space>
                                                    ))}
                                                    <Button type="dashed" onClick={() => addSpare()} icon={<PlusOutlined />} size="small" style={{ width: '150px' }}>
                                                        Add Spare Item
                                                    </Button>
                                                </div>
                                            )}
                                        </Form.List>
                                    </Form.Item>
                                </Col>

                                <Col span={2}>
                                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                                </Col>
                            </Row>
                        ))}
                        <Form.Item>
                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                Add Asset for Spares Issue
                            </Button>
                        </Form.Item>
                    </>
                )}
            </Form.List>
        </Card>
    );
};

export default DailySparesSection;
