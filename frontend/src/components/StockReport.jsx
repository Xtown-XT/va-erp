import { useState, useEffect } from "react";
import {
  Button,
  Table,
  Card,
  Typography,
  message,
  Row,
  Col,
  DatePicker,
  Select,
  Statistic,
  Space,
} from "antd";
import {
  FilePdfOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../service/api";
import { truncateToFixed } from "../utils/textUtils";
import { useVehicles, useCompressors } from "../hooks/useQueries";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;

const StockReport = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [itemTypeFilter, setItemTypeFilter] = useState("all");
  const [totals, setTotals] = useState({
    totalOpeningStock: 0,
    totalInward: 0,
    totalOutward: 0,
    totalBalance: 0,
  });

  // Fetch machines and compressors for item type dropdown
  const { data: machines = [] } = useVehicles();
  const { data: compressors = [] } = useCompressors();

  // Build item type options
  const itemTypeOptions = [
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

  // Fetch monthly report
  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      const month = selectedMonth.month() + 1; // dayjs months are 0-indexed
      const year = selectedMonth.year();
      
      let url = `/api/items/monthly-report?month=${month}&year=${year}`;
      
      if (itemTypeFilter !== "all") {
        url += `&itemType=${encodeURIComponent(itemTypeFilter)}`;
      }

      const res = await api.get(url);
      setItems(res.data.data || []);
      setTotals(res.data.totals || {
        totalOpeningStock: 0,
        totalInward: 0,
        totalOutward: 0,
        totalBalance: 0,
      });
    } catch (err) {
      console.error("Error fetching monthly report", err);
      message.error("Error fetching monthly report");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedMonth, itemTypeFilter]);

  // Export to PDF
  const exportToPDF = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Stock Report - ${selectedMonth.format("MMMM YYYY")}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border: 1px solid #ddd; }
            .summary-row { display: flex; justify-content: space-around; margin: 10px 0; }
            .summary-item { text-align: center; }
            .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Monthly Stock Report</h1>
            <h3>${selectedMonth.format("MMMM YYYY")}</h3>
            <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            ${itemTypeFilter !== "all" ? `<p><strong>Item Type:</strong> ${itemTypeFilter}</p>` : ""}
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <div class="summary-row">
              <div class="summary-item">
                <strong>Total Items:</strong> ${items.length}
              </div>
              <div class="summary-item">
                <strong>Opening Stock:</strong> ${truncateToFixed(totals.totalOpeningStock, 2)}
              </div>
              <div class="summary-item">
                <strong>Inward:</strong> <span style="color: green;">+${truncateToFixed(totals.totalInward, 2)}</span>
              </div>
              <div class="summary-item">
                <strong>Outward:</strong> <span style="color: red;">-${truncateToFixed(totals.totalOutward, 2)}</span>
              </div>
              <div class="summary-item">
                <strong>Closing Balance:</strong> <strong>${truncateToFixed(totals.totalBalance, 2)}</strong>
              </div>
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
                  <td>${truncateToFixed(item.openingStock || 0, 2)}</td>
                  <td style="color: green;">${item.inward > 0 ? '+' : ''}${truncateToFixed(item.inward || 0, 2)}</td>
                  <td style="color: red;">${item.outward > 0 ? '-' : ''}${truncateToFixed(item.outward || 0, 2)}</td>
                  <td><strong>${truncateToFixed(item.balance || 0, 2)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #f9f9f9; font-weight: bold;">
                <td colspan="5" style="text-align: right;">TOTALS:</td>
                <td>${truncateToFixed(totals.totalOpeningStock, 2)}</td>
                <td style="color: green;">+${truncateToFixed(totals.totalInward, 2)}</td>
                <td style="color: red;">-${truncateToFixed(totals.totalOutward, 2)}</td>
                <td><strong>${truncateToFixed(totals.totalBalance, 2)}</strong></td>
              </tr>
            </tfoot>
          </table>
          
          <div class="footer">
            <p>VA-ERP Inventory Management System</p>
          </div>
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
      width: 200 
    },
    { 
      title: "Part Number", 
      dataIndex: "partNumber", 
      key: "partNumber", 
      width: 150 
    },
    { 
      title: "Type", 
      dataIndex: "itemType", 
      key: "itemType",
      width: 150,
    },
    { 
      title: "Category", 
      dataIndex: "groupName", 
      key: "groupName", 
      width: 120 
    },
    { 
      title: "Units", 
      dataIndex: "units", 
      key: "units", 
      width: 80 
    },
    {
      title: "Opening Stock",
      dataIndex: "openingStock",
      key: "openingStock",
      width: 130,
      render: (value) => (
        <Text style={{ fontSize: "14px" }}>
          {truncateToFixed(value || 0, 2)}
        </Text>
      ),
    },
    {
      title: "Inward",
      dataIndex: "inward",
      key: "inward",
      width: 110,
      render: (value) => (
        <Text style={{ fontSize: "14px", color: "#52c41a", fontWeight: "500" }}>
          {value > 0 ? `+${truncateToFixed(value, 2)}` : "0"}
        </Text>
      ),
    },
    {
      title: "Outward",
      dataIndex: "outward",
      key: "outward",
      width: 110,
      render: (value) => (
        <Text style={{ fontSize: "14px", color: "#ff4d4f", fontWeight: "500" }}>
          {value > 0 ? `-${truncateToFixed(value, 2)}` : "0"}
        </Text>
      ),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      width: 130,
      fixed: "right",
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
  ];

  return (
    <div style={{ padding: "20px" }}>
      <Card>
        {/* Header */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate("/items")}
              >
                Back to Items
              </Button>
              <Title level={2} style={{ margin: 0 }}>Monthly Stock Report</Title>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchMonthlyReport}
              >
                Refresh
              </Button>
              <Button
                icon={<FilePdfOutlined />}
                onClick={exportToPDF}
                type="primary"
                disabled={items.length === 0}
              >
                Export PDF
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Summary Cards */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Opening Stock"
                value={truncateToFixed(totals.totalOpeningStock, 2)}
                precision={2}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Inward"
                value={truncateToFixed(totals.totalInward, 2)}
                precision={2}
                valueStyle={{ color: "#52c41a" }}
                prefix="+"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Outward"
                value={truncateToFixed(totals.totalOutward, 2)}
                precision={2}
                valueStyle={{ color: "#ff4d4f" }}
                prefix="-"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Closing Balance"
                value={truncateToFixed(totals.totalBalance, 2)}
                precision={2}
                valueStyle={{ color: "#1890ff", fontWeight: "bold" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={8}>
            <Text strong>Month/Year:</Text>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(date) => setSelectedMonth(date || dayjs())}
              style={{ width: "100%", marginTop: 8 }}
              format="MMMM YYYY"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Text strong>Filter by Item Type:</Text>
            <Select
              value={itemTypeFilter}
              onChange={setItemTypeFilter}
              style={{ width: "100%", marginTop: 8 }}
              allowClear
              onClear={() => setItemTypeFilter("all")}
            >
              <Option value="all">All Types</Option>
              {itemTypeOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Text strong>Total Items:</Text>
            <div style={{ marginTop: 8, fontSize: "24px", fontWeight: "bold", color: "#1890ff" }}>
              {items.length}
            </div>
          </Col>
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            pageSizeOptions: ["20", "50", "100", "200"],
            showTotal: (total) => `Total ${total} items`,
          }}
          scroll={{ x: 1200 }}
          size="small"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ backgroundColor: "#fafafa", fontWeight: "bold" }}>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <Text strong>TOTALS:</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Text strong>{truncateToFixed(totals.totalOpeningStock, 2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <Text strong style={{ color: "#52c41a" }}>
                    +{truncateToFixed(totals.totalInward, 2)}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}>
                  <Text strong style={{ color: "#ff4d4f" }}>
                    -{truncateToFixed(totals.totalOutward, 2)}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  <Text strong style={{ fontSize: "16px" }}>
                    {truncateToFixed(totals.totalBalance, 2)}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

export default StockReport;

