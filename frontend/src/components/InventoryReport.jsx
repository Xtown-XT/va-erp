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
  Statistic,
} from "antd";
import { FilePdfOutlined, FileExcelOutlined } from "@ant-design/icons";
import { useInventoryReport, useVehicles, useCompressors, useSites } from "../hooks/useQueries";
import { truncateToFixed } from "../utils/textUtils";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;

const InventoryReport = () => {
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [itemTypeFilter, setItemTypeFilter] = useState("");
  const [selectedSite, setSelectedSite] = useState(null);

  const month = selectedMonth.month() + 1; // dayjs months are 0-indexed
  const year = selectedMonth.year();

  // Fetch machines and compressors for filter
  const { data: machines = [] } = useVehicles();
  const { data: compressors = [] } = useCompressors();
  const { data: sites = [] } = useSites();

  // Build item type options
  const itemTypeOptions = [
    { label: "All Types", value: "" },
    { label: "Drilling Tools", value: "Drilling Tools" },
    ...machines.map((m) => ({
      label: `Machine: ${m.vehicleNumber}`,
      value: m.vehicleNumber,
    })),
    ...compressors.map((c) => ({
      label: `Compressor: ${c.compressorName}`,
      value: c.compressorName,
    })),
  ];

  // Fetch inventory report
  const { data: reportData, isLoading } = useInventoryReport(
    month,
    year,
    itemTypeFilter,
    selectedSite
  );

  const items = reportData?.data || [];
  const totals = reportData?.totals || {
    totalOpeningStock: 0,
    totalInward: 0,
    totalOutward: 0,
    totalBalance: 0,
  };

  // Export to Excel (CSV format)
  const exportToExcel = () => {
    const csv = [
      ["Inventory Report"],
      [`Month: ${selectedMonth.format("MMMM YYYY")}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      [
        "Item Name",
        "Part Number",
        "Item Type",
        "Category",
        "Units",
        "Opening Stock",
        "Inward",
        "Outward",
        "Balance",
      ],
      ...items.map((item) => [
        item.itemName,
        item.partNumber,
        item.itemType,
        item.groupName,
        item.units,
        item.openingStock || 0,
        item.inward || 0,
        item.outward || 0,
        item.balance || 0,
      ]),
      [],
      ["TOTALS", "", "", "", "", totals.totalOpeningStock, totals.totalInward, totals.totalOutward, totals.totalBalance],
    ];

    const csvContent = csv.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventory-report-${selectedMonth.format("YYYY-MM")}.csv`;
    link.click();
  };

  // Export to PDF
  const exportToPDF = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Inventory Report - ${selectedMonth.format("MMMM YYYY")}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; display: flex; justify-content: space-around; }
            .summary-item { text-align: center; }
            .footer { margin-top: 20px; padding-top: 10px; border-top: 2px solid #333; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Inventory Report</h1>
            <p><strong>Month:</strong> ${selectedMonth.format("MMMM YYYY")}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            ${itemTypeFilter ? `<p><strong>Filtered by:</strong> ${itemTypeFilter}</p>` : ""}
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <h3>${totals.totalOpeningStock.toFixed(2)}</h3>
              <p>Opening Stock</p>
            </div>
            <div class="summary-item">
              <h3 style="color: green;">${totals.totalInward.toFixed(2)}</h3>
              <p>Inward</p>
            </div>
            <div class="summary-item">
              <h3 style="color: red;">${totals.totalOutward.toFixed(2)}</h3>
              <p>Outward</p>
            </div>
            <div class="summary-item">
              <h3>${totals.totalBalance.toFixed(2)}</h3>
              <p>Balance</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Part Number</th>
                <th>Type</th>
                <th>Category</th>
                <th>Units</th>
                <th>Opening Stock</th>
                <th>Inward</th>
                <th>Outward</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.itemName}</td>
                  <td>${item.partNumber}</td>
                  <td>${item.itemType}</td>
                  <td>${item.groupName}</td>
                  <td>${item.units}</td>
                  <td>${(item.openingStock || 0).toFixed(2)}</td>
                  <td style="color: green;">${(item.inward || 0).toFixed(2)}</td>
                  <td style="color: red;">${(item.outward || 0).toFixed(2)}</td>
                  <td><strong>${(item.balance || 0).toFixed(2)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot class="footer">
              <tr>
                <td colspan="5"><strong>TOTALS</strong></td>
                <td><strong>${totals.totalOpeningStock.toFixed(2)}</strong></td>
                <td style="color: green;"><strong>${totals.totalInward.toFixed(2)}</strong></td>
                <td style="color: red;"><strong>${totals.totalOutward.toFixed(2)}</strong></td>
                <td><strong>${totals.totalBalance.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const columns = [
    {
      title: "Item Name",
      dataIndex: "itemName",
      key: "itemName",
      fixed: "left",
      width: 150,
    },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      width: 120,
    },
    {
      title: "Item Type",
      dataIndex: "itemType",
      key: "itemType",
      width: 150,
    },
    {
      title: "Category",
      dataIndex: "groupName",
      key: "groupName",
      width: 120,
    },
    {
      title: "Units",
      dataIndex: "units",
      key: "units",
      width: 80,
    },
    {
      title: "Opening Stock",
      dataIndex: "openingStock",
      key: "openingStock",
      width: 120,
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "Inward",
      dataIndex: "inward",
      key: "inward",
      width: 100,
      render: (value) => (
        <Text style={{ color: "#52c41a" }}>
          {value > 0 ? `+${truncateToFixed(value, 2)}` : "0"}
        </Text>
      ),
    },
    {
      title: "Outward",
      dataIndex: "outward",
      key: "outward",
      width: 100,
      render: (value) => (
        <Text style={{ color: "#ff4d4f" }}>
          {value > 0 ? `-${truncateToFixed(value, 2)}` : "0"}
        </Text>
      ),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      width: 120,
      render: (value) => (
        <Text
          strong
          style={{
            color: value > 0 ? "#52c41a" : value < 0 ? "#ff4d4f" : "#000",
            fontSize: "16px",
          }}
        >
          {truncateToFixed(value || 0, 2)}
        </Text>
      ),
    },
    ...(itemTypeFilter === 'Drilling Tools' ? [
      {
        title: "Total RPM",
        dataIndex: "totalRPM",
        key: "totalRPM",
        width: 100,
        render: (val) => truncateToFixed(val || 0, 1)
      },
      {
        title: "Total Meter",
        dataIndex: "totalMeter",
        key: "totalMeter",
        width: 100,
        render: (val) => truncateToFixed(val || 0, 1)
      }
    ] : [])
  ];

  return (
    <div style={{ padding: "20px" }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Title level={2}>Inventory Report</Title>
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
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12}>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(date) => setSelectedMonth(date || dayjs())}
              style={{ width: "100%" }}
              format="MMMM YYYY"
            />
          </Col>
          <Col xs={24} sm={12}>
            <Select
              placeholder="Filter by Item Type"
              value={itemTypeFilter}
              onChange={setItemTypeFilter}
              style={{ width: "100%" }}
              allowClear
            >
              {itemTypeOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12}>
            <Select
              placeholder="Filter by Site"
              value={selectedSite}
              onChange={setSelectedSite}
              style={{ width: "100%" }}
              allowClear
            >
              {sites.map((site) => (
                <Option key={site.id} value={site.id}>
                  {site.siteName}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>

        {/* Summary Statistics */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="Opening Stock"
                value={totals.totalOpeningStock}
                precision={2}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="Inward"
                value={totals.totalInward}
                precision={2}
                valueStyle={{ color: "#52c41a" }}
                prefix="+"
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="Outward"
                value={totals.totalOutward}
                precision={2}
                valueStyle={{ color: "#ff4d4f" }}
                prefix="-"
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="Balance"
                value={totals.totalBalance}
                precision={2}
                valueStyle={{
                  color: totals.totalBalance > 0 ? "#52c41a" : "#ff4d4f",
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={items}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default InventoryReport;

