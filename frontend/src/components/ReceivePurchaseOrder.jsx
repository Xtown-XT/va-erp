import React, { useState, useEffect } from "react";
import {
    Modal,
    Form,
    InputNumber,
    Select,
    Button,
    Table,
    Space,
    Typography,
    message,
    Divider,
    Tag
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import api from "../service/api";

const { Option } = Select;
const { Text } = Typography;

const ReceivePurchaseOrder = ({ visible, po, onCancel, onSuccess }) => {
    const [sites, setSites] = useState([]);

    // Structure: { [itemId]: [ { key: 1, siteId: "...", quantity: 5 } ] }
    const [distributions, setDistributions] = useState({});

    useEffect(() => {
        const fetchSites = async () => {
            try {
                const res = await api.get('/api/sites');
                if (res.data.success) setSites(res.data.data);
            } catch (e) { }
        };
        fetchSites();
    }, []);

    // Initialize distributions with empty row for each item
    useEffect(() => {
        if (po && po.items) {
            const initialDist = {};
            po.items.forEach(item => {
                initialDist[item.id] = [{ key: Date.now() + Math.random(), siteId: null, quantity: item.quantity }];
            });
            setDistributions(initialDist);
        }
    }, [po]);

    const handleAddRow = (itemId) => {
        const newRow = { key: Date.now() + Math.random(), siteId: null, quantity: 0 };
        setDistributions(prev => ({
            ...prev,
            [itemId]: [...(prev[itemId] || []), newRow]
        }));
    };

    const handleRemoveRow = (itemId, rKey) => {
        setDistributions(prev => ({
            ...prev,
            [itemId]: prev[itemId].filter(r => r.key !== rKey)
        }));
    };

    const handleRowChange = (itemId, rKey, field, value) => {
        setDistributions(prev => ({
            ...prev,
            [itemId]: prev[itemId].map(r => r.key === rKey ? { ...r, [field]: value } : r)
        }));
    };

    const handleSubmit = async () => {
        // Validation: Check matching quantities
        for (const item of po.items) {
            const dists = distributions[item.id] || [];
            const total = dists.reduce((sum, d) => sum + (d.quantity || 0), 0);
            if (total !== item.quantity) {
                return message.error(`Quantity mismatch for item ${item.spare?.name || item.drillingTool?.name}. Distributed: ${total}, Required: ${item.quantity}`);
            }
            if (dists.some(d => !d.siteId)) {
                return message.error("Please select site for all rows");
            }
        }

        try {
            // Transform for API
            // API expects: { distribution: { [itemId]: [{ siteId, quantity }] } }
            const payload = { distribution: distributions };

            await api.post(
                `/api/purchase-orders/${po.id}/receive`,
                payload
            );
            message.success("PO Received successfully");
            onSuccess();
        } catch (error) {
            message.error(error.response?.data?.message || "Failed to receive PO");
        }
    };

    return (
        <Modal
            title={`Receive PO: ${po.poNumber}`}
            open={visible}
            onCancel={onCancel}
            onOk={handleSubmit}
            width={900}
        >
            <div className="max-h-[60vh] overflow-y-auto">
                {po.items.map(item => {
                    const dists = distributions[item.id] || [];
                    const currentTotal = dists.reduce((sum, d) => sum + (d.quantity || 0), 0);
                    const itemName = item.spare?.name || item.drillingTool?.name;
                    const isSpare = item.itemType === 'spare';

                    return (
                        <div key={item.id} className="mb-6 border p-4 rounded bg-gray-50">
                            <div className="flex justify-between items-center mb-2">
                                <Text strong>{itemName} ({isSpare ? 'Spare' : 'Tool'}) <Tag color="blue">Qty: {item.quantity}</Tag></Text>
                                <Text type={currentTotal === item.quantity ? "success" : "danger"}>
                                    Distributed: {currentTotal} / {item.quantity}
                                </Text>
                            </div>

                            {dists.map((row, index) => (
                                <div key={row.key} className="flex gap-4 mb-2 items-center">
                                    <Select
                                        placeholder="Select Site"
                                        style={{ width: 300 }}
                                        value={row.siteId}
                                        onChange={v => handleRowChange(item.id, row.key, 'siteId', v)}
                                    >
                                        {sites.map(site => (
                                            <Option key={site.id} value={site.id}>{site.siteName}</Option>
                                        ))}
                                    </Select>
                                    <InputNumber
                                        placeholder="Qty"
                                        min={1}
                                        value={row.quantity}
                                        onChange={v => handleRowChange(item.id, row.key, 'quantity', v)}
                                    />
                                    {index > 0 && (
                                        <Button danger icon={<DeleteOutlined />} onClick={() => handleRemoveRow(item.id, row.key)} />
                                    )}
                                </div>
                            ))}
                            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => handleAddRow(item.id)}>
                                Split to another site
                            </Button>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
};

export default ReceivePurchaseOrder;
