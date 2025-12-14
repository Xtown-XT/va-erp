import React, { useState } from "react";
import { Card, Table, Button, Select, InputNumber, Row, Col, Space, Popconfirm, Tag, message } from "antd";
import { PlusOutlined, DeleteOutlined, ToolOutlined } from "@ant-design/icons";
import { useItemsByType } from "../hooks/useQueries"; // Assuming hook exists

const DrillingToolsSection = ({
    drillingTools, // Array of tools
    onAddTool,
    onRemoveTool,
    onUpdateTool,
    compressorName,
    siteId
}) => {
    const { data: availableHammerBits = [] } = useItemsByType('hammer_bit', siteId); // Fetch tools with stock
    const [selectedItem, setSelectedItem] = useState(null);
    const [quantity, setQuantity] = useState(1);

    const handleAdd = () => {
        if (!selectedItem) return;
        onAddTool(selectedItem, quantity);
        setSelectedItem(null);
        setQuantity(1);
    };

    const columns = [
        { title: "Item Name", dataIndex: "itemName", key: "itemName" },
        { title: "Part Number", dataIndex: "partNumber", key: "partNumber" },
        { title: "Starting RPM", dataIndex: "startingRPM", key: "startingRPM" },
        {
            title: "Current RPM",
            dataIndex: "currentRPM",
            key: "currentRPM",
            render: (val, record) => (
                <InputNumber
                    value={val}
                    disabled={!record.isExisting} // New tools auto-calc from 0? or daily RPM?
                    onChange={(v) => onUpdateTool(record.id, 'currentRPM', v)}
                />
            )
        },
        {
            title: "Current Meter",
            dataIndex: "currentMeter",
            key: "currentMeter",
            render: (val, record) => (
                <InputNumber
                    value={val}
                    onChange={(v) => onUpdateTool(record.id, 'currentMeter', v)}
                />
            )
        },
        {
            title: "Action",
            key: "action",
            render: (_, record) => (
                <Popconfirm title="Remove tool?" onConfirm={() => onRemoveTool(record.id)}>
                    <Button icon={<DeleteOutlined />} danger size="small" />
                </Popconfirm>
            )
        }
    ];

    // Filter out available tools
    const toolOptions = availableHammerBits.map(t => ({
        label: `${t.itemName} (${t.partNumber}) - Stock: ${t.balance}`,
        value: t.id,
        item: t
    }));

    return (
        <Card
            className="mb-4 shadow-md"
            title={<Space><ToolOutlined /> <span>Drilling Tools (Compressor: {compressorName || 'None'})</span></Space>}
        >
            <div className="mb-4 bg-gray-50 p-2 rounded">
                <Space>
                    <Select
                        style={{ width: 300 }}
                        placeholder="Select Drilling Tool to Fit"
                        showSearch
                        optionFilterProp="label"
                        value={selectedItem ? selectedItem.id : null}
                        onChange={(val, opt) => setSelectedItem(opt.item)}
                        options={toolOptions}
                    />
                    <InputNumber
                        min={1}
                        value={quantity}
                        onChange={setQuantity}
                        placeholder="Qty"
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!selectedItem}>
                        Fit Tool
                    </Button>
                </Space>
            </div>

            <Table
                dataSource={drillingTools}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                rowClassName={(record) => record.action === 'remove' ? 'bg-red-50 opacity-50' : ''}
            />
        </Card>
    );
};

export default DrillingToolsSection;
