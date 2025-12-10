import React, { useState } from "react";
import {
    Card,
    DatePicker,
    Button,
    Table,
    Space,
    Typography,
    message,
    Tag,
    Select,
    Row,
    Col
} from "antd";
import { SearchOutlined, FileExcelOutlined, FilePdfOutlined } from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { useSites } from "../hooks/useQueries";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const SparesReport = () => {
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState([
        dayjs().startOf("month"),
        dayjs().endOf("month"),
    ]);
    const [selectedSite, setSelectedSite] = useState(null);
    const [reportData, setReportData] = useState([]);

    const { data: sites = [] } = useSites();

    const fetchReport = async () => {
        if (!dateRange || dateRange.length !== 2) {
            return message.error("Please select a date range");
        }

        setLoading(true);
        try {
            const startDate = dateRange[0].format("YYYY-MM-DD");
            const endDate = dateRange[1].format("YYYY-MM-DD");

            let url = `/api/reports/spares-usage-log?startDate=${startDate}&endDate=${endDate}`;
            if (selectedSite) {
                url += `&siteId=${selectedSite}`;
            }

            const res = await api.get(url);

            if (res.data.success) {
                setReportData(res.data.data);
            }
        } catch (error) {
            message.error("Failed to fetch report");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        const workbook = XLSX.utils.book_new();

        const sheetData = reportData.map((item) => ({
            Date: dayjs(item.date).format("DD/MM/YYYY"),
            Site: item.siteName,
            "Machine/Compressor": item.machineNumber || item.compressorName || "-",
            "Spare Name": item.spareName,
            "Part Number": item.partNumber,
            Category: item.category,
            "Quantity Used": item.quantity,
        }));

        const worksheet = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Spares Usage");

        XLSX.writeFile(
            workbook,
            `Spares_Usage_Report_${dateRange[0].format("YYYY-MM-DD")}_to_${dateRange[1].format("YYYY-MM-DD")}.xlsx`
        );
    };

    const exportToPDF = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text("Spares Usage Report", 14, 20);

        // Date Range
        doc.setFontSize(12);
        doc.text(`From: ${dateRange[0].format("DD/MM/YYYY")} To: ${dateRange[1].format("DD/MM/YYYY")}`, 14, 28);

        // Table
        const tableColumn = ["Date", "Site", "Machine/Compressor", "Spare Name", "Part No", "Category", "Qty"];
        const tableRows = [];

        reportData.forEach(item => {
            const rowData = [
                dayjs(item.date).format("DD/MM/YYYY"),
                item.siteName,
                item.machineNumber || item.compressorName || "-",
                item.spareName,
                item.partNumber,
                item.category,
                item.quantity
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            startY: 35,
            head: [tableColumn],
            body: tableRows,
        });

        doc.save(`Spares_Usage_Report_${dateRange[0].format("YYYY-MM-DD")}_to_${dateRange[1].format("YYYY-MM-DD")}.pdf`);
    };

    const columns = [
        {
            title: "Date",
            dataIndex: "date",
            key: "date",
            render: (val) => dayjs(val).format("DD/MM/YYYY"),
            width: 100,
        },
        {
            title: "Site",
            dataIndex: "siteName",
            key: "siteName",
            width: 150,
        },
        {
            title: "Machine / Compressor",
            key: "machineOrComp",
            width: 180,
            render: (_, record) => (
                <Text>
                    {record.machineNumber ? (
                        <Tag color="blue">{record.machineNumber}</Tag>
                    ) : record.compressorName ? (
                        <Tag color="cyan">{record.compressorName}</Tag>
                    ) : (
                        "-"
                    )}
                </Text>
            ),
        },
        {
            title: "Spare Name",
            dataIndex: "spareName",
            key: "spareName",
            render: (text, record) => (
                <div>
                    <div className="font-medium">{text}</div>
                    <div className="text-xs text-gray-500">{record.category}</div>
                </div>
            ),
        },
        {
            title: "Part Number",
            dataIndex: "partNumber",
            key: "partNumber",
            width: 120,
        },
        {
            title: "Quantity",
            dataIndex: "quantity",
            key: "quantity",
            width: 100,
            render: (val) => <Tag color="red">-{val}</Tag>,
        },
    ];

    return (
        <div className="p-4">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <Title level={3} style={{ margin: 0 }}>Spares Usage Report</Title>
                    {reportData.length > 0 && (
                        <Space>
                            <Button
                                icon={<FileExcelOutlined />}
                                onClick={exportToExcel}
                            >
                                Export Excel
                            </Button>
                            <Button
                                icon={<FilePdfOutlined />}
                                onClick={exportToPDF}
                                type="primary"
                                danger
                            >
                                Export PDF
                            </Button>
                        </Space>
                    )}
                </div>

                <Row gutter={[16, 16]} className="mb-4">
                    <Col xs={24} sm={8}>
                        <Text strong className="block mb-1">Date Range</Text>
                        <RangePicker
                            value={dateRange}
                            onChange={setDateRange}
                            format="DD/MM/YYYY"
                            className="w-full"
                        />
                    </Col>
                    <Col xs={24} sm={6}>
                        <Text strong className="block mb-1">Filter by Site</Text>
                        <Select
                            placeholder="All Sites"
                            value={selectedSite}
                            onChange={setSelectedSite}
                            className="w-full"
                            allowClear
                        >
                            {sites.map(site => (
                                <Option key={site.id} value={site.id}>{site.siteName}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={4} className="flex items-end">
                        <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            onClick={fetchReport}
                            loading={loading}
                            className="w-full"
                        >
                            Generate
                        </Button>
                    </Col>
                </Row>

                <Table
                    columns={columns}
                    dataSource={reportData}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 20 }}
                    size="small"
                    bordered
                />
            </Card>
        </div>
    );
};

export default SparesReport;
