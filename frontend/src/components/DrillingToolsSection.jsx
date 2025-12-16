import React, { useState } from "react";
import { Card, Table, Button, Select, InputNumber, Row, Col, Space, Popconfirm, Tag, message } from "antd";
import { PlusOutlined, DeleteOutlined, ToolOutlined } from "@ant-design/icons";
import { useSiteStock } from "../hooks/useQueries";

const DrillingToolsSection = ({
    drillingTools, // Array of tools
    onAddTool,
    onRemoveTool,
    onUpdateTool,
    compressorName,
    siteId,
    currentMeterValue = 0 // Total meter from shift1 + shift2
}) => {
    // Fetch Site Stock (contains { spares: [], tools: [] })
    const { data: stockData } = useSiteStock(siteId);
    const availableTools = stockData?.tools || [];

    const [selectedItem, setSelectedItem] = useState(null);

    const handleAdd = () => {
        if (!selectedItem) return;
        // Always fit 1 tool with current meter value (shift1 + shift2)
        onAddTool(selectedItem, 1, currentMeterValue);
        setSelectedItem(null);
    };

    const columns = [
        {
            title: "Tool Name",
            dataIndex: "itemName",
            key: "itemName",
            width: 200
        },
        {
            title: "Part Number",
            dataIndex: "partNumber",
            key: "partNumber",
            width: 150
        },
        {
            title: "Fitted RPM",
            dataIndex: "startingRPM",
            key: "startingRPM",
            width: 120,
            render: (val) => val || '-'
        },
        {
            title: "Removed RPM",
            dataIndex: "removedRPM",
            key: "removedRPM",
            width: 120,
            render: (val, record) => record.action === 'remove' ? (val || record.currentRPM) : '-'
        },
        {
            title: "Accumulated Meter",
            dataIndex: "accumulatedMeter",
            key: "accumulatedMeter",
            width: 150,
            render: (val) => (
                <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                    {val || 0}
                </span>
            )
        },
        {
            title: "Action",
            key: "action",
            width: 100,
            render: (_, record) => (
                <Popconfirm title="Remove tool?" onConfirm={() => onRemoveTool(record.id)}>
                    <Button icon={<DeleteOutlined />} danger size="small">Remove</Button>
                </Popconfirm>
            )
        }
    ];

    // Filter out available tools
    const toolOptions = availableTools.map(t => ({
        label: `${t.name} (${t.partNumber}) - Stock: ${t.quantity}`,
        value: t.toolId,
        item: t
    }));

    // Filter out tools marked for removal so they don't appear in the UI
    const visibleTools = (drillingTools || []).filter(t => t.action !== 'remove');

    return (
        <Card
            className="mb-4 shadow-md"
            title={<Space><ToolOutlined /> <span>Drilling Tools (Compressor: {compressorName || 'None'})</span></Space>}
        >
            <div className="mb-4 bg-gray-50 p-3 rounded">
                <Space>
                    <Select
                        style={{ width: 350 }}
                        placeholder="Select Drilling Tool to Fit"
                        showSearch
                        optionFilterProp="label"
                        value={selectedItem ? selectedItem.toolId : null}
                        onChange={(val, opt) => setSelectedItem(opt.item)}
                        options={toolOptions}
                    />
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                        disabled={!selectedItem || selectedItem.quantity <= 0}
                    >
                        Fit Tool
                    </Button>
                    {selectedItem && (
                        <span style={{ color: '#666', fontSize: '12px' }}>
                            (Will fit 1 tool with current meter: {currentMeterValue})
                        </span>
                    )}
                </Space>
            </div>

            <Table
                dataSource={visibleTools}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: 'No tools fitted yet' }}
            />
        </Card>
    );
};

export default DrillingToolsSection;
