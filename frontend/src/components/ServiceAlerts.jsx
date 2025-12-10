import React, { useState, useEffect } from "react";
import { Badge, Popover, List, Tag } from "antd";
import { BellOutlined } from "@ant-design/icons";
import api from "../service/api";

const ServiceAlerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/service/alerts");
            if (res.data.success) {
                setAlerts(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch alerts:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
        // Refresh alerts every 5 minutes
        const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const getSeverityColor = (severity) => {
        switch (severity) {
            case "high":
                return "red";
            case "medium":
                return "orange";
            default:
                return "blue";
        }
    };

    const content = (
        <div style={{ maxWidth: 400, maxHeight: 400, overflow: "auto" }}>
            {alerts.length === 0 ? (
                <div className="text-center py-4 text-gray-400">No alerts</div>
            ) : (
                <List
                    dataSource={alerts}
                    renderItem={(alert) => (
                        <List.Item key={`${alert.type}-${alert.assetId}`}>
                            <div>
                                <Tag color={getSeverityColor(alert.severity)}>
                                    {alert.severity.toUpperCase()}
                                </Tag>
                                <div className="font-semibold">{alert.name}</div>
                                <div className="text-sm text-gray-600">{alert.message}</div>
                            </div>
                        </List.Item>
                    )}
                />
            )}
        </div>
    );

    return (
        <Popover
            content={content}
            title="Service Alerts"
            trigger="click"
            open={visible}
            onOpenChange={setVisible}
            placement="bottomRight"
        >
            <Badge count={alerts.length} offset={[-5, 5]}>
                <div
                    style={{
                        cursor: "pointer",
                        padding: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <BellOutlined
                        style={{
                            fontSize: "22px",
                            color: "white",
                        }}
                        spin={loading}
                    />
                </div>
            </Badge>
        </Popover>
    );
};

export default ServiceAlerts;
