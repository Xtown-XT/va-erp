import React, { useState, useEffect } from "react";
import {
    Table,
    Button,
    Card,
    Tabs,
    List,
    Typography,
    Alert,
    Tag,
    Badge,
    Space,
    message
} from "antd";
import {
    PlusOutlined,
    ReloadOutlined,
    ToolOutlined,
    BellOutlined
} from "@ant-design/icons";
import axios from "axios";
import { getAuthHeader } from "../service/auth";
import dayjs from "dayjs";
import ServiceEntryForm from "./ServiceEntryForm";

const { Text } = Typography;
const { TabPane } = Tabs;

const ServiceManagement = () => {
    const [history, setHistory] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isEntryModalVisible, setIsEntryModalVisible] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [histRes, notifRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/service/history`, { headers: getAuthHeader() }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/service/notifications`, { headers: getAuthHeader() })
            ]);

            if (histRes.data.success) setHistory(histRes.data.data);
            if (notifRes.data.success) setNotifications(notifRes.data.data);

        } catch (error) {
            message.error("Failed to load service data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const columns = [
        { title: "Date", dataIndex: "serviceDate", render: d => dayjs(d).format("DD/MM/YYYY") },
        { title: "Asset", render: (_, r) => r.machine?.vehicleNumber || r.compressor?.compressorName || "-" },
        { title: "Service", dataIndex: "serviceName" },
        { title: "Type", dataIndex: "serviceType" },
        { title: "Items Used", render: (_, r) => r.items?.length || 0 },
        { title: "RPM", dataIndex: "currentRpm" },
    ];

    return (
        <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card title={<><BellOutlined /> Alerts</>} className="md:col-span-1 shadow-sm">
                    <List
                        itemLayout="horizontal"
                        dataSource={notifications}
                        renderItem={item => (
                            <List.Item>
                                <List.Item.Meta
                                    avatar={<Badge status="error" />}
                                    title={<Text strong>{item.name} ({item.type})</Text>}
                                    description={<Text type="danger">{item.message}</Text>}
                                />
                                <Button size="small" type="primary" onClick={() => setIsEntryModalVisible(true)}>Service</Button>
                            </List.Item>
                        )}
                        locale={{ emptyText: "No Alerts" }}
                    />
                </Card>

                <Card title="Service History" className="md:col-span-2 shadow-sm" extra={
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={fetchData} />
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsEntryModalVisible(true)}>
                            New Service Entry
                        </Button>
                    </Space>
                }>
                    <Table
                        columns={columns}
                        dataSource={history}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 5 }}
                    />
                </Card>
            </div>

            {isEntryModalVisible && (
                <ServiceEntryForm
                    visible={isEntryModalVisible}
                    onCancel={() => setIsEntryModalVisible(false)}
                    onSuccess={() => {
                        setIsEntryModalVisible(false);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
};

export default ServiceManagement;
