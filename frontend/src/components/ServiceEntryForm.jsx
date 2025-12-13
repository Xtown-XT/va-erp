import React, { useState, useEffect } from "react";
import { Form, Select, Input, Button, Space, Card, Row, Col, InputNumber } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useItemsByType } from "../hooks/useQueries"; // Assuming this hook exists or similar

const ServiceEntryForm = ({
    assetType,
    assetId,
    maintenanceConfig, // The config array from the asset
    serviceDoneField, // e.g., 'machineServiceDone'
    serviceNameField, // e.g., 'machineServiceName'
    sparesField,      // e.g., 'machineSpares'
    form,
    label
}) => {
    const { data: spares = [] } = useItemsByType('spare');
    const [selectedService, setSelectedService] = useState(null);
    const [isServiceActive, setIsServiceActive] = useState(false);

    // Watch for changes in form to keep local state in sync if needed, 
    // but mostly relying on Antd Form
    const currentServiceDone = Form.useWatch(serviceDoneField, form);

    useEffect(() => {
        setIsServiceActive(currentServiceDone);
    }, [currentServiceDone]);

    const serviceOptions = (maintenanceConfig || []).map(c => ({
        label: c.name + (c.cycle ? ` (Cycle: ${c.cycle})` : ''),
        value: c.name
    }));

    // Append 'Ad-hoc' option? Or allow search/create?
    // Select with tagging/custom input is best.

    return (
        <Card
            size="small"
            title={label}
            extra={
                <Form.Item name={serviceDoneField} valuePropName="checked" noStyle>
                    <Select
                        style={{ width: 120 }}
                        placeholder="No Service"
                        allowClear
                        onChange={(val) => {
                            // If cleared, it sends undefined, we treat as false/no service
                        }}
                        options={[
                            { label: 'No Service', value: false },
                            { label: 'Service Done', value: true }
                        ]}
                    />
                </Form.Item>
            }
            className={!isServiceActive ? "bg-gray-50" : "border-blue-400"}
        >
            {isServiceActive && (
                <>
                    <Form.Item
                        name={serviceNameField}
                        label="Service Type"
                        rules={[{ required: true, message: 'Please select or enter service name' }]}
                    >
                        <Select
                            mode="tags" // Allows creating new items
                            placeholder="Select or type service name"
                            options={serviceOptions}
                            maxCount={1} // Only 1 service name per entry for now?
                        />
                    </Form.Item>

                    <Form.List name={sparesField}>
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Row key={key} gutter={8} align="middle" className="mb-2">
                                        <Col span={10}>
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'itemId']}
                                                rules={[{ required: true, message: 'Missing spare' }]}
                                                noStyle
                                            >
                                                <Select
                                                    showSearch
                                                    placeholder="Select Spare"
                                                    optionFilterProp="children"
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
                                        </Col>
                                        <Col span={6}>
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'quantity']}
                                                rules={[{ required: true, message: 'Qty' }]}
                                                noStyle
                                            >
                                                <InputNumber placeholder="Qty" min={1} style={{ width: '100%' }} />
                                            </Form.Item>
                                        </Col>
                                        <Col span={2}>
                                            <Button icon={<DeleteOutlined />} onClick={() => remove(name)} danger size="small" />
                                        </Col>
                                    </Row>
                                ))}
                                <Form.Item>
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                        Add Spare
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form.List>
                </>
            )}
        </Card>
    );
};

export default ServiceEntryForm;
