import React from "react";
import { Card, Form, Select, InputNumber, Row, Col, Divider, Button, Space, Input } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import ServiceEntryForm from "./ServiceEntryForm"; // Component we just created

const ShiftForm = ({
    shift,
    form,
    sites,
    machines,
    employees,
    onMachineChange,
    loading,
    isActive,
    onToggle,
    machineMaintenanceConfig,
    compressorMaintenanceConfig
}) => {
    if (!isActive) {
        return (
            <Card className="mb-4 bg-gray-50 opacity-60">
                <Row justify="space-between" align="middle">
                    <Col>
                        <h3 className="text-lg font-semibold text-gray-500">Shift {shift} (Disabled)</h3>
                    </Col>
                    <Col>
                        <Button onClick={onToggle} type="dashed">Enable Shift {shift}</Button>
                    </Col>
                </Row>
            </Card>
        );
    }

    const prefix = shift === 1 ? "" : "shift2_"; // Prefix for fields if we flatten, or just use nested paths?
    // Existing DailyEntry used separate states object.
    // Ideally, Antd Form should use nested paths like `shifts[0].machineId` etc.
    // But refactoring the entire data structure might be too risky for the backend controller which expects flat-ish structure or specific body keys.
    // The backend controller expects `machineId`, `shift`, etc. at root for Create?
    // DailyEntry.jsx constructs payload manually from state.

    // Let's assume we pass `initialValues` and `name` prefix to Form Items.
    // Actually, let's look at `DailyEntry.jsx` submit logic.
    // It sends `machineId`, `machineOpeningRPM` etc.
    // For Shift 2, we might literally just be submitting a second API call?
    // No, `DailyEntry` creates ONE entry per shift usually?
    // Backend `create` makes ONE entry.
    // The UI allows creating two entries (Shift 1 and Shift 2) at once?
    // `DailyEntry.jsx` has `shift1Enabled` and `shift2Enabled`.
    // It seems it submits TWICE if both are enabled?
    // Let's check `handleSubmit` in `DailyEntry.jsx`.

    // Checking `DailyEntry.jsx` (Step 114):
    // Line 797: `if (shift1Enabled) { ... await createDailyEntry.mutateAsync(payload1) ... }`
    // Line 866: `if (shift2Enabled) { ... await createDailyEntry.mutateAsync(payload2) ... }`
    // So yes, it makes separate API calls.
    // We can treat ShiftForm as filling a specific set of fields in the `form` instance, 
    // prefixed or namespaced so they don't collide.

    // Let's use `shift1_` and `shift2_` prefixes for everything in the form values to avoid collision.

    const p = (name) => `shift${shift}_${name}`;

    return (
        <Card
            className="mb-4 shadow-md"
            title={
                <Row justify="space-between" align="middle">
                    <span>Shift {shift} Entry</span>
                    {shift === 2 && <Button size="small" danger onClick={onToggle}>Disable</Button>}
                </Row>
            }
        >
            {/* Scope: Site / Machine / Compressor */}
            <Row gutter={16}>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={p("siteId")}
                        label="Site"
                        rules={[{ required: true, message: "Site required" }]}
                    >
                        <Select
                            showSearch
                            placeholder="Select Site"
                            optionFilterProp="children"
                            disabled={shift === 2} // Usually linked to Shift 1
                        >
                            {sites.map(s => <Select.Option key={s.id} value={s.id}>{s.siteName}</Select.Option>)}
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    <Form.Item
                        name={p("machineId")}
                        label="Machine"
                        rules={[{ required: true, message: "Machine required" }]}
                    >
                        <Select
                            showSearch
                            placeholder="Select Machine"
                            optionFilterProp="children"
                            onChange={(val) => onMachineChange && onMachineChange(val, shift)}
                        >
                            {machines.map(m => (
                                <Select.Option key={m.id} value={m.id}>
                                    {m.machineNumber || m.machineType}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                    {/* Compressor is often auto-selected, but display it */}
                    <Form.Item
                        name={p("compressorId")}
                        label="Compressor"
                    >
                        <Select disabled placeholder="Auto-set from Machine">
                            {/* Options populated by machine selection logic really */}
                        </Select>
                    </Form.Item>
                </Col>
            </Row>

            <Divider orientation="left">Production & Fuel</Divider>

            <Row gutter={16}>
                <Col xs={12} md={6}>
                    <Form.Item name={p("noOfHoles")} label="Holes">
                        <InputNumber min={0} className="w-full" />
                    </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                    <Form.Item name={p("meter")} label="Meter">
                        <InputNumber min={0} className="w-full" />
                    </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                    <Form.Item name={p("dieselUsed")} label="Diesel (L)">
                        <InputNumber min={0} className="w-full" />
                    </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                    <Form.Item name={p("machineHSD")} label="Machine HSD (L)">
                        <InputNumber min={0} className="w-full" />
                    </Form.Item>
                </Col>
            </Row>

            <Divider orientation="left">RPM Log</Divider>
            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Card size="small" title="Machine RPM">
                        <Row gutter={8}>
                            <Col span={12}>
                                <Form.Item name={p("machineOpeningRPM")} label="Opening">
                                    <InputNumber className="w-full" placeholder="Open" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name={p("machineClosingRPM")} label="Closing">
                                    <InputNumber className="w-full" placeholder="Close" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card size="small" title="Compressor RPM">
                        <Row gutter={8}>
                            <Col span={12}>
                                <Form.Item name={p("compressorOpeningRPM")} label="Opening">
                                    <InputNumber className="w-full" placeholder="Open" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name={p("compressorClosingRPM")} label="Closing">
                                    <InputNumber className="w-full" placeholder="Close" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>
                </Col>
            </Row>

            <Divider orientation="left">Crew Change (Add Employees)</Divider>
            <Form.List name={p("employees")}>
                {(fields, { add, remove }) => (
                    <>
                        {/* Always show at least 2 rows if empty? Or managed by parent initialValues */}
                        {fields.map(({ key, name, ...restField }) => (
                            <Row key={key} gutter={8} align="middle" className="mb-2">
                                <Col span={10}>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'employeeId']}
                                        // rules={[{ required: true, message: 'Missing emp' }]} // Optional for helper?
                                        noStyle
                                    >
                                        <Select placeholder="Select Employee" showSearch optionFilterProp="children">
                                            {employees.map(e => (
                                                <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={10}>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'role']}
                                        noStyle
                                    >
                                        <Select placeholder="Role">
                                            <Select.Option value="operator">Operator</Select.Option>
                                            <Select.Option value="helper">Helper</Select.Option>
                                            <Select.Option value="site_in_charge">Site In-Charge</Select.Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={4}>
                                    {/* <Button icon={<DeleteOutlined />} onClick={() => remove(name)} danger size="small" /> */}
                                </Col>
                            </Row>
                        ))}
                    </>
                )}
            </Form.List>

        </Card>
    );
};

export default ShiftForm;
