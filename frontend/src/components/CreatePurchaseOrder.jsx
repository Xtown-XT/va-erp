import React, { useState, useEffect } from "react";
import { Modal, Form, Input, DatePicker, Select, Button, InputNumber, Row, Col, Divider, Space, Table, message, Typography } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;

const CreatePurchaseOrder = ({ visible, onCancel, onSuccess, editingPO }) => {
    const [form] = Form.useForm();
    const [suppliers, setSuppliers] = useState([]);
    const [items, setItems] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [poItems, setPoItems] = useState([]); // Used for inline rows
    const [gstInclude, setGstInclude] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchData();
            if (editingPO) {
                // TODO: Edit mode population
            } else {
                form.resetFields();
                setPoItems([]);
                setGstInclude(false);
                generatePONumber();
            }
        }
    }, [visible, editingPO]);

    const fetchData = async () => {
        try {
            const [suppliersRes, itemsRes, addressRes] = await Promise.all([
                api.get("/api/suppliers"),
                api.get("/api/items/by-type/all"), // CORRECTED ENDPOINT
                api.get("/api/address")
            ]);

            if (suppliersRes.data.success) setSuppliers(suppliersRes.data.data);
            if (itemsRes.data.success) setItems(itemsRes.data.data);
            if (addressRes.data.success) setAddresses(addressRes.data.data);
        } catch (error) {
            console.error("Fetch Error:", error);
            message.error("Failed to load dependency data");
        }
    };

    const generatePONumber = async () => {
        try {
            const res = await api.get("/api/purchase-orders/generate-ref");
            if (res.data.success) {
                form.setFieldsValue({ orderNumber: res.data.refNo });
            }
        } catch (error) {
            console.error("Failed to generate ref");
        }
    };

    // Inline Item Actions
    const handleAddRow = () => {
        const newRow = {
            key: Date.now(),
            id: Date.now(),
            itemId: null,
            itemType: 'spare', // default
            quantity: 1,
            rate: 0,
            total: 0
        };
        setPoItems([...poItems, newRow]);
    };

    const handleRemoveRow = (key) => {
        setPoItems(poItems.filter(item => item.key !== key));
    };

    const handleRowChange = (key, field, value) => {
        const newItems = poItems.map(row => {
            if (row.key === key) {
                const updatedRow = { ...row, [field]: value };

                // Logic when item changes
                if (field === 'itemId') {
                    const selectedItem = items.find(i => i.id === value);
                    if (selectedItem) {
                        updatedRow.item = selectedItem;
                        updatedRow.rate = selectedItem.price || 0;
                        // Infer type if needed
                        updatedRow.itemType = selectedItem.itemType === 'Drilling Tool' ? 'drillingTool' : 'spare';
                    }
                }

                // Recalculate total
                if (['quantity', 'rate', 'itemId'].includes(field)) {
                    updatedRow.total = (updatedRow.quantity || 0) * (updatedRow.rate || 0);
                }

                return updatedRow;
            }
            return row;
        });
        setPoItems(newItems);
    };

    // Calculation Logic
    const calculateTotals = () => {
        const gstPercent = form.getFieldValue('gstPercent') || 18;
        let subTotal = 0;
        let taxTotal = 0;
        let grandTotal = 0;

        poItems.forEach(item => {
            const totalAmount = item.total;
            let itemGST = 0;
            let itemBase = 0;

            if (gstInclude && gstPercent > 0) {
                // Inclusive
                itemGST = (totalAmount * gstPercent) / (100 + gstPercent);
                itemBase = totalAmount - itemGST;
            } else {
                // Exclusive (or No GST)
                itemBase = totalAmount;
                itemGST = 0;
            }

            subTotal += itemBase;
            taxTotal += itemGST;
            grandTotal += totalAmount;
        });

        return { subTotal, taxTotal, grandTotal };
    };

    const totals = calculateTotals();

    const handleSubmit = async (values) => {
        if (poItems.length === 0) {
            message.error("Please add at least one item");
            return;
        }

        // Validate items
        if (poItems.some(i => !i.itemId)) {
            message.error("Please select an item for all rows");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...values,
                items: poItems,
                gstInclude: gstInclude
            };

            const res = await api.post("/api/purchase-orders", payload);
            if (res.data.success) {
                message.success("Purchase Order Created");
                onSuccess();
            }
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to create PO");
        } finally {
            setLoading(false);
        }
    };

    // Columns for Inline Edit
    const columns = [
        {
            title: 'Type',
            dataIndex: 'itemType',
            width: 150,
            render: (text, record) => (
                <Select
                    value={record.itemType}
                    onChange={(val) => handleRowChange(record.key, 'itemType', val)}
                    style={{ width: '100%' }}
                >
                    <Select.Option value="spare">Spare</Select.Option>
                    <Select.Option value="drillingTool">Drilling Tool</Select.Option>
                </Select>
            )
        },
        {
            title: 'Item',
            dataIndex: 'itemId',
            render: (text, record) => {
                // Filter items based on selected Type
                const type = record.itemType || 'spare'; // Default to spare if undefined
                const filteredItems = items.filter(i => {
                    if (type === 'spare') return i.itemType === 'Spare';
                    if (type === 'drillingTool') return i.itemType === 'Drilling Tool';
                    return false;
                });

                return (
                    <Select
                        showSearch
                        style={{ width: 300 }}
                        placeholder="Select Item"
                        optionFilterProp="children"
                        value={record.itemId}
                        onChange={(val) => handleRowChange(record.key, 'itemId', val)}
                        disabled={!record.itemType} // Disable if no type selected (though default is set)
                    >
                        {filteredItems.map(i => (
                            <Select.Option key={i.id} value={i.id}>
                                {i.itemName} {i.partNumber ? `(${i.partNumber})` : (i.serialNumber ? `(${i.serialNumber})` : '')}
                            </Select.Option>
                        ))}
                    </Select>
                );
            }
        },
        {
            title: 'Qty',
            dataIndex: 'quantity',
            render: (text, record) => (
                <InputNumber
                    min={1}
                    value={record.quantity}
                    onChange={(val) => handleRowChange(record.key, 'quantity', val)}
                    disabled={record.itemType === 'drillingTool'} // Disable qty for drilling tools per user logic? usually tools are unique. Or allow > 1? User didn't specify, but often tools are 1. Let's keep enabled unless requested. Wait, previous code had disabled={!type} logic but not specifically Qty disable. I will leave ENABLED for now.
                // Actually, in the Modal version previously, it had `disabled={isTool}` for Qty. Tools are usually serialized. 
                // Let's re-add that logic if it was there. Checking line 209 in original view (line 209 in step 2399 view said disabled={isTool}).
                // So yes, I should disable qty for tools or set to 1.
                />
            )
        },
        {
            title: 'Rate',
            dataIndex: 'rate',
            render: (text, record) => (
                <InputNumber
                    min={0}
                    value={record.rate}
                    onChange={(val) => handleRowChange(record.key, 'rate', val)}
                    style={{ width: 120 }}
                />
            )
        },
        {
            title: 'Total',
            dataIndex: 'total',
            render: (val) => `₹${Number(val).toFixed(2)}`
        },
        {
            title: 'Action',
            render: (_, record) => (
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveRow(record.key)} />
            )
        }
    ];

    return (
        <Modal
            title="Create Purchase Order"
            open={visible}
            onCancel={onCancel}
            width={1100}
            footer={null}
            destroyOnClose
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ gstPercent: 18, gstInclude: false }}>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="orderNumber" label="PO Number">
                            <Input disabled />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="date" label="Date" initialValue={dayjs()} rules={[{ required: true }]}>
                            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="supplierId" label="Supplier" rules={[{ required: true }]}>
                            <Select
                                placeholder="Select Supplier"
                                showSearch
                                optionFilterProp="children"
                            >
                                {suppliers.map(s => (
                                    <Select.Option key={s.id} value={s.id}>{s.supplierName}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="addressId" label="Billing Address" rules={[{ required: true }]}>
                            <Select placeholder="Select Billing Address">
                                {addresses.map(a => (
                                    <Select.Option key={a.id} value={a.id}>
                                        {a.addressBill} ({a.phone})
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="shippingAddressId" label="Shipping Address" rules={[{ required: true }]}>
                            <Select placeholder="Select Shipping Address">
                                {addresses.map(a => (
                                    <Select.Option key={a.id} value={a.id}>
                                        {a.addressShip} ({a.phone})
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={4}>
                        <Form.Item name="gstInclude" label="GST Included" valuePropName="checked">
                            <Select value={gstInclude} onChange={setGstInclude}>
                                <Select.Option value={false}>No / Exclusive</Select.Option>
                                <Select.Option value={true}>Inclusive</Select.Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    {gstInclude && (
                        <Col span={4}>
                            <Form.Item name="gstPercent" label="GST %">
                                <InputNumber min={0} max={100} />
                            </Form.Item>
                        </Col>
                    )}
                </Row>
                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item name="notes" label="Notes">
                            <TextArea rows={2} />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider orientation="left">Items</Divider>
                <div style={{ marginBottom: 16 }}>
                    <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />}>
                        Add New Item
                    </Button>
                </div>

                <Table
                    dataSource={poItems}
                    rowKey="key"
                    columns={columns}
                    pagination={false}
                    bordered
                    size="small"
                />

                <div className="mt-4 p-4 bg-gray-50 rounded" style={{ marginTop: 16, background: '#f5f5f5', padding: 16 }}>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Text strong>Sub Total: ₹{totals.subTotal.toFixed(2)}</Text>
                        </Col>
                        <Col span={8}>
                            <Text strong>GST: ₹{totals.taxTotal.toFixed(2)}</Text>
                        </Col>
                        <Col span={8}>
                            <Text strong className="text-lg">Grand Total: ₹{totals.grandTotal.toFixed(2)}</Text>
                        </Col>
                    </Row>
                </div>

                <div style={{ textAlign: 'right', marginTop: 16 }}>
                    <Button onClick={onCancel} style={{ marginRight: 8 }}>Cancel</Button>
                    <Button type="primary" htmlType="submit" loading={loading}>Create PO</Button>
                </div>
            </Form>
        </Modal>
    );
};

export default CreatePurchaseOrder;