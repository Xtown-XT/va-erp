import React, { useState, useEffect } from "react";
import {
  Card,
  DatePicker,
  Button,
  Table,
  Space,
  Typography,
  Select,
  Row,
  Col,
  Statistic,
  message
} from "antd";
import {
  SearchOutlined,
  DownloadOutlined
} from "@ant-design/icons";
import axios from "axios";
import { getAuthHeader } from "../service/auth";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;
const { Title } = Typography;

const Reports = () => {
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    if (!dateRange) return;
    setLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/inventory/reports/stock?startDate=${startDate}&endDate=${endDate}`,
        { headers: getAuthHeader() }
      );

      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (error) {
      message.error("Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []); // Initial load

  const columns = [
    { title: "Item Name", dataIndex: "name", key: "name" },
    { title: "Part No.", dataIndex: "partNumber", key: "partNumber" },
    { title: "Opening Balance", dataIndex: "openingBalance", sorter: (a, b) => a.openingBalance - b.openingBalance },
    { title: "Purchased (In)", dataIndex: "purchased", sorter: (a, b) => a.purchased - b.purchased, className: "text-green-600" },
    { title: "Consumed (Out)", dataIndex: "consumed", sorter: (a, b) => a.consumed - b.consumed, className: "text-red-600" },
    { title: "Closing Balance", dataIndex: "closingBalance", sorter: (a, b) => a.closingBalance - b.closingBalance, render: (v) => <b>{v}</b> }
  ];

  return (
    <div className="p-4">
      <Card title="Stock Report">
        <Space className="mb-4">
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchReport}>
            Generate Report
          </Button>
          <Button icon={<DownloadOutlined />}>Export CSV</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={reportData}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          summary={pageData => {
            let totalIn = 0;
            let totalOut = 0;
            pageData.forEach(({ purchased, consumed }) => {
              totalIn += purchased;
              totalOut += consumed;
            });
            return (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}>Total</Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text type="success">{totalIn}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <Text type="danger">{totalOut}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>
    </div>
  );
};

const Text = Typography.Text;

export default Reports;
