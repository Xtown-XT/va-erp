import { useState } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Select,
  Button,
  Table,
  DatePicker,
  Space,
  Tag,
} from "antd";
import { FilePdfOutlined, FileExcelOutlined } from "@ant-design/icons";
import { useServiceUsageReport, useVehicles, useCompressors } from "../hooks/useQueries";
import { truncateToFixed } from "../utils/textUtils";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const ServiceUsageReport = () => {
  const [dateRange, setDateRange] = useState([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedCompressor, setSelectedCompressor] = useState("");

  // Fetch machines and compressors
  const { data: machines = [] } = useVehicles();
  const { data: compressors = [] } = useCompressors();

  const startDate = dateRange[0]?.format("YYYY-MM-DD");
  const endDate = dateRange[1]?.format("YYYY-MM-DD");

  // Fetch service usage report
  const { data: usageData = [], isLoading } = useServiceUsageReport(
    startDate,
    endDate,
    selectedVehicle,
    selectedCompressor
  );

  // Export to Excel (CSV format)
  const exportToExcel = () => {
    const csv = [
      ["Service Usage Report"],
      [`Date Range: ${startDate} to ${endDate}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      [
        "Date",
        "Item Name",
        "Part Number",
        "Service Type",
        "Total RPM Run",
        "Total Meter Run",
        "Quantity",
        "Status",
      ],
      ...usageData.map((item) => [
        item.fittedDate,
        item.item?.itemName || "",
        item.item?.partNumber || "",
        item.serviceType,
        item.totalRPMRun || "",
        item.totalMeterRun || "",
        item.quantity,
        item.status,
      ]),
    ];

    const csvContent = csv.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `service-usage-report-${startDate}-to-${endDate}.csv`;
    link.click();
  };

  // Export to PDF
  const exportToPDF = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Service Usage Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 10px; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header { text-align: center; margin-bottom: 20px; }
            .fitted { background-color: #e6f7ff; }
            .removed { background-color: #fff2e8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Service Usage Report</h1>
            <p><strong>Date Range:</strong> ${startDate} to ${endDate}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            ${selectedVehicle ? `<p><strong>Machine:</strong> ${machines.find(m => m.id === selectedVehicle)?.vehicleNumber || ""}</p>` : ""}
            ${selectedCompressor ? `<p><strong>Compressor:</strong> ${compressors.find(c => c.id === selectedCompressor)?.compressorName || ""}</p>` : ""}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Item Name</th>
                <th>Part Number</th>
                <th>Type</th>
                <th>RPM Run</th>
                <th>Meter Run</th>
                <th>Qty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${usageData.map(item => `
                <tr class="${item.status === 'fitted' ? 'fitted' : 'removed'}">
                  <td>${item.fittedDate}</td>
                  <td>${item.item?.itemName || ""}</td>
                  <td>${item.item?.partNumber || ""}</td>
                  <td>${item.serviceType}</td>
                  <td><strong>${item.totalRPMRun ? truncateToFixed(item.totalRPMRun, 2) : "-"}</strong></td>
                  <td>${item.totalMeterRun ? truncateToFixed(item.totalMeterRun, 2) : "-"}</td>
                  <td>${item.quantity}</td>
                  <td>${item.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px;">
            <p><strong>Total Records:</strong> ${usageData.length}</p>
            <p><strong>Currently Fitted:</strong> ${usageData.filter(i => i.status === 'fitted').length}</p>
            <p><strong>Removed:</strong> ${usageData.filter(i => i.status === 'removed').length}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const columns = [
    {
      title: "Fitted Date",
      dataIndex: "fittedDate",
      key: "fittedDate",
      width: 90,
    },
    {
      title: "Item Name",
      dataIndex: ["item", "itemName"],
      key: "itemName",
      width: 120,
    },
    {
      title: "Part Number",
      dataIndex: ["item", "partNumber"],
      key: "partNumber",
      width: 100,
    },
    {
      title: "Service Type",
      dataIndex: "serviceType",
      key: "serviceType",
      width: 100,
      render: (value) => {
        const colors = {
          machine: "blue",
          compressor: "green",
          drilling_tool: "purple",
        };
        return <Tag color={colors[value] || "default"}>{value}</Tag>;
      },
    },
    {
      title: "Total RPM Run",
      dataIndex: "totalRPMRun",
      key: "totalRPMRun",
      width: 100,
      render: (value) => (
        value ? (
          <Text strong style={{ color: "#1890ff" }}>
            {truncateToFixed(value, 2)}
          </Text>
        ) : (
          "-"
        )
      ),
    },
    {
      title: "Total Meter Run",
      dataIndex: "totalMeterRun",
      key: "totalMeterRun",
      width: 100,
      render: (value) => (
        value ? (
          <Text strong style={{ color: "#52c41a" }}>
            {truncateToFixed(value, 2)} m
          </Text>
        ) : (
          "-"
        )
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      width: 70,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (value) => {
        const colors = {
          fitted: "blue",
          removed: "default",
        };
        return <Tag color={colors[value] || "default"}>{value}</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Title level={2}>Service Usage Report</Title>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<FileExcelOutlined />}
                onClick={exportToExcel}
                type="default"
              >
                Export Excel
              </Button>
              <Button
                icon={<FilePdfOutlined />}
                onClick={exportToPDF}
                type="default"
              >
                Export PDF
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Filters */}
        <Row gutter={[8, 8]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8} md={6}>
            <Text strong style={{ display: "block", marginBottom: 4 }}>
              Date Range
            </Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates || [dayjs(), dayjs()])}
              style={{ width: "100%" }}
              format="YYYY-MM-DD"
              placeholder={["Start Date", "End Date"]}
              size="small"
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Text strong style={{ display: "block", marginBottom: 4 }}>
              Machine
            </Text>
            <Select
              placeholder="Select Machine"
              value={selectedVehicle}
              onChange={setSelectedVehicle}
              style={{ width: "100%" }}
              allowClear
              showSearch
              size="small"
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {machines.map((m) => (
                <Option key={m.id} value={m.id}>
                  {m.vehicleNumber}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Text strong style={{ display: "block", marginBottom: 4 }}>
              Compressor
            </Text>
            <Select
              placeholder="Select Compressor"
              value={selectedCompressor}
              onChange={setSelectedCompressor}
              style={{ width: "100%" }}
              allowClear
              showSearch
              size="small"
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {compressors.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.compressorName}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>

        {/* Summary */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Text strong>Total Records: </Text>
              <Text style={{ fontSize: "20px", color: "#1890ff" }}>
                {usageData.length}
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Text strong>Currently Fitted: </Text>
              <Text style={{ fontSize: "20px", color: "#52c41a" }}>
                {usageData.filter((i) => i.status === "fitted").length}
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Text strong>Removed: </Text>
              <Text style={{ fontSize: "20px", color: "#ff4d4f" }}>
                {usageData.filter((i) => i.status === "removed").length}
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={usageData}
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          size="small"
          rowClassName={(record) =>
            record.status === "fitted" ? "bg-blue-50" : ""
          }
        />
      </Card>
    </div>
  );
};

export default ServiceUsageReport;

