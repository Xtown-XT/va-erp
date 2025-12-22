import React, { useState } from "react";
import {
  Card,
  Button,
  Table,
  DatePicker,
  Space,
  Typography,
  message,
  Segmented,
  Select,
} from "antd";
import { FileExcelOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import api from "../service/api";
import dayjs from "dayjs";
import { useSites, useMachines } from "../hooks/useQueries";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const SiteProductionReport = () => {
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("sitewise"); // 'sitewise', 'machinewise', 'daywise'
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);
  const [reportData, setReportData] = useState([]);

  // Fetch sites and machines
  const { data: sites = [] } = useSites();
  const { data: machines = [] } = useMachines();

  const fetchReport = async () => {
    if (!dateRange || dateRange.length !== 2) {
      return message.error("Please select a date range");
    }

    if (viewMode === "daywise" && !selectedSite && !selectedMachine) {
      return message.error("Please select a Site OR a Machine for Day-wise report");
    }

    setLoading(true);
    try {
      const startDate = dateRange[0].format("YYYY-MM-DD");
      const endDate = dateRange[1].format("YYYY-MM-DD");

      let endpoint = "";
      let params = `startDate=${startDate}&endDate=${endDate}`;

      if (viewMode === "sitewise") {
        endpoint = "/api/reports/production-sitewise";
      } else if (viewMode === "machinewise") {
        endpoint = "/api/reports/production-machinewise";
      } else if (viewMode === "daywise") {
        endpoint = "/api/reports/production-daywise";
        params += `&siteId=${selectedSite}`;
        if (selectedMachine) {
          params += `&machineId=${selectedMachine}`;
        }
      }

      const res = await api.get(`${endpoint}?${params}`);

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
    const sheetData = reportData.map((row) => {
      let firstColKey = "Name";
      let firstColVal = "";

      if (viewMode === "sitewise") {
        firstColKey = "Site Name";
        firstColVal = row.siteName;
      } else if (viewMode === "machinewise") {
        firstColKey = "Machine Number";
        firstColVal = row.machineNumber;
      } else {
        firstColKey = "Date";
        firstColVal = row.date; // or format it
      }

      const baseData = {
        [firstColKey]: firstColVal,
      };

      if (viewMode === "machinewise") {
        baseData["Machine Type"] = row.machineType;
      }

      return {
        ...baseData,
        Meter: row.totalMeter?.toFixed(2) || 0,
        "Crawler HSD": row.totalCrawlerHSD?.toFixed(2) || 0,
        "Comp HSD": row.totalCompHSD?.toFixed(2) || 0,
        "Camper HSD": row.totalCamperHSD?.toFixed(2) || 0,
        "Total HSD": row.totalTotalHSD?.toFixed(2) || 0,
        "Crawler RPM": row.totalCrawlerRPM?.toFixed(2) || 0,
        "Comp RPM": row.totalCompRPM?.toFixed(2) || 0,
        "HSD/MTR": row.hsdPerMeter?.toFixed(2) || 0,
        "MTR/RPM": row.meterPerRPM?.toFixed(2) || 0,
        "Crawler HSD/RPM": row.crawlerHSDPerRPM?.toFixed(2) || 0,
        "Comp HSD/RPM": row.compHSDPerRPM?.toFixed(2) || 0,
        Holes: row.totalHoles || 0,
        "Depth Avg": row.avgDepth?.toFixed(2) || 0,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Production Report");

    XLSX.writeFile(
      workbook,
      `Production_Report_${viewMode}_${dateRange[0].format("YYYY-MM-DD")}_to_${dateRange[1].format("YYYY-MM-DD")}.xlsx`
    );
  };

  const exportToPDF = () => {
    const doc = new jsPDF("l", "pt", "a4"); // Landscape orientation
    const title = `Production Report (${viewMode}) - ${dateRange[0].format(
      "DD/MM/YYYY"
    )} to ${dateRange[1].format("DD/MM/YYYY")}`;

    let firstColHeader = "Name";
    if (viewMode === "sitewise") firstColHeader = "Site Name";
    else if (viewMode === "machinewise") firstColHeader = "Machine";
    else firstColHeader = "Date";

    const tableColumn = [
      firstColHeader,
      ...(viewMode === "machinewise" ? ["Type"] : []),
      "Meter",
      "Crwl HSD",
      "Comp HSD",
      "Cmpr HSD",
      "Tot HSD",
      "Crwl RPM",
      "Comp RPM",
      "HSD/M",
      "M/RPM",
      "Crwl H/R",
      "Comp H/R",
      "Holes",
      "Depth",
    ];

    const tableRows = reportData.map((row) => {
      let firstColVal = "";
      if (viewMode === "sitewise") firstColVal = row.siteName;
      else if (viewMode === "machinewise") firstColVal = row.machineNumber;
      else firstColVal = dayjs(row.date).format("DD/MM/YYYY");

      const rowData = [
        firstColVal,
        ...(viewMode === "machinewise" ? [row.machineType || "-"] : []),
        row.totalMeter?.toFixed(2) || "0",
        row.totalCrawlerHSD?.toFixed(2) || "0",
        row.totalCompHSD?.toFixed(2) || "0",
        row.totalCamperHSD?.toFixed(2) || "0",
        row.totalTotalHSD?.toFixed(2) || "0",
        row.totalCrawlerRPM?.toFixed(2) || "0",
        row.totalCompRPM?.toFixed(2) || "0",
        row.hsdPerMeter?.toFixed(2) || "0",
        row.meterPerRPM?.toFixed(2) || "0",
        row.crawlerHSDPerRPM?.toFixed(2) || "0",
        row.compHSDPerRPM?.toFixed(2) || "0",
        row.totalHoles || "0",
        row.avgDepth?.toFixed(2) || "0",
      ];
      return rowData;
    });

    // Add totals row
    const totals = calculateTotals();
    const totalsRow = [
      "TOTAL",
      ...(viewMode === "machinewise" ? ["-"] : []),
      totals.totalMeter?.toFixed(2) || "0",
      totals.totalCrawlerHSD?.toFixed(2) || "0",
      totals.totalCompHSD?.toFixed(2) || "0",
      totals.totalCamperHSD?.toFixed(2) || "0",
      totals.totalTotalHSD?.toFixed(2) || "0",
      totals.totalCrawlerRPM?.toFixed(2) || "0",
      totals.totalCompRPM?.toFixed(2) || "0",
      totals.hsdPerMeter?.toFixed(2) || "0",
      totals.meterPerRPM?.toFixed(2) || "0",
      totals.crawlerHSDPerRPM?.toFixed(2) || "0",
      totals.compHSDPerRPM?.toFixed(2) || "0",
      totals.totalHoles || "0",
      totals.avgDepth?.toFixed(2) || "0",
    ];

    tableRows.push(totalsRow);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [22, 160, 133] }, // Greenish
    });

    doc.text(title, 40, 30);
    doc.save(`Production_Report_${dayjs().format("YYYYMMDD_HHmmss")}.pdf`);
  };

  const columns = [
    {
      title:
        viewMode === "sitewise"
          ? "Site Name"
          : viewMode === "machinewise"
            ? "Machine Number"
            : "Date",
      dataIndex:
        viewMode === "sitewise"
          ? "siteName"
          : viewMode === "machinewise"
            ? "machineNumber"
            : "date",
      key: "name",
      render: (val) =>
        viewMode === "daywise" ? dayjs(val).format("DD/MM/YYYY") : val,
    },
    ...(viewMode === "machinewise"
      ? [
        {
          title: "Type",
          dataIndex: "machineType",
          key: "machineType",
        },
      ]
      : []),
    {
      title: "Meter",
      dataIndex: "totalMeter",
      key: "totalMeter",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "Crwl HSD",
      dataIndex: "totalCrawlerHSD",
      key: "totalCrawlerHSD",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "Comp HSD",
      dataIndex: "totalCompHSD",
      key: "totalCompHSD",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "Camper HSD",
      dataIndex: "totalCamperHSD",
      key: "totalCamperHSD",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "Total HSD",
      dataIndex: "totalTotalHSD",
      key: "totalTotalHSD",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "Crwl RPM",
      dataIndex: "totalCrawlerRPM",
      key: "totalCrawlerRPM",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "Comp RPM",
      dataIndex: "totalCompRPM",
      key: "totalCompRPM",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "HSD/M",
      dataIndex: "hsdPerMeter",
      key: "hsdPerMeter",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "M/RPM",
      dataIndex: "meterPerRPM",
      key: "meterPerRPM",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "Crwl H/R",
      dataIndex: "crawlerHSDPerRPM",
      key: "crawlerHSDPerRPM",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "Comp HSD/RPM",
      dataIndex: "compHSDPerRPM",
      key: "compHSDPerRPM",
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: "Holes",
      dataIndex: "totalHoles",
      key: "totalHoles",
    },
    {
      title: "Depth Avg",
      dataIndex: "avgDepth",
      key: "avgDepth",
      render: (val) => val?.toFixed(2) || 0,
    },
  ];

  // Calculate totals for summary row
  const calculateTotals = () => {
    if (reportData.length === 0) return {};

    const totals = reportData.reduce(
      (acc, row) => ({
        totalMeter: acc.totalMeter + (row.totalMeter || 0),
        totalCrawlerHSD: acc.totalCrawlerHSD + (row.totalCrawlerHSD || 0),
        totalCompHSD: acc.totalCompHSD + (row.totalCompHSD || 0),
        totalCamperHSD: acc.totalCamperHSD + (row.totalCamperHSD || 0),
        totalTotalHSD: acc.totalTotalHSD + (row.totalTotalHSD || 0),
        totalCrawlerRPM: acc.totalCrawlerRPM + (row.totalCrawlerRPM || 0),
        totalCompRPM: acc.totalCompRPM + (row.totalCompRPM || 0),
        totalHoles: acc.totalHoles + (row.totalHoles || 0),
      }),
      {
        totalMeter: 0,
        totalCrawlerHSD: 0,
        totalCompHSD: 0,
        totalCamperHSD: 0,
        totalTotalHSD: 0,
        totalCrawlerRPM: 0,
        totalCompRPM: 0,
        totalHoles: 0,
      }
    );

    return {
      ...totals,
      hsdPerMeter:
        totals.totalMeter > 0 ? totals.totalTotalHSD / totals.totalMeter : 0,
      meterPerRPM:
        totals.totalCompRPM > 0 ? totals.totalMeter / totals.totalCompRPM : 0,
      crawlerHSDPerRPM:
        totals.totalCrawlerRPM > 0
          ? totals.totalCrawlerHSD / totals.totalCrawlerRPM
          : 0,
      compHSDPerRPM:
        totals.totalCompRPM > 0
          ? totals.totalCompHSD / totals.totalCompRPM
          : 0,
      avgDepth:
        totals.totalHoles > 0 ? totals.totalMeter / totals.totalHoles : 0,
    };
  };

  return (
    <div className="p-4">
      <Card>
        <Title level={3}>Production Report</Title>

        <Space direction="vertical" size="large" className="w-full">
          <Space size="large" wrap align="end">
            <div>
              <Text strong className="block mb-1">
                Report Type
              </Text>
              <Segmented
                options={[
                  { label: "Site-wise", value: "sitewise" },
                  { label: "Machine-wise", value: "machinewise" },
                  { label: "Day-wise Breakdown", value: "daywise" },
                ]}
                value={viewMode}
                onChange={(val) => {
                  setViewMode(val);
                  setReportData([]); // Clear old data on switch
                }}
              />
            </div>

            {viewMode === "daywise" && (
              <>
                <div style={{ minWidth: 200 }}>
                  <Text strong className="block mb-1">
                    Select Site (Optional if Machine selected)
                  </Text>
                  <Select
                    placeholder="Select Site"
                    value={selectedSite}
                    onChange={(val) => {
                      setSelectedSite(val);
                    }}
                    options={sites.map((s) => ({
                      label: s.siteName,
                      value: s.id,
                    }))}
                    style={{ width: "100%" }}
                    showSearch
                    optionFilterProp="label"
                  />
                </div>
                <div style={{ minWidth: 200 }}>
                  <Text strong className="block mb-1">
                    Select Machine (Optional if Site selected)
                  </Text>
                  <Select
                    placeholder="All Machines"
                    value={selectedMachine}
                    onChange={setSelectedMachine}
                    allowClear
                    options={machines
                      .filter(m => !selectedSite || m.siteId === selectedSite) // Filter machines by selected site if possible, or show all
                      .map((m) => ({
                        label: `${m.machineType} ${m.machineNumber}`,
                        value: m.id,
                      }))}
                    style={{ width: "100%" }}
                    showSearch
                    optionFilterProp="label"
                  />
                </div>
              </>
            )}

            <div>
              <Text strong className="block mb-1">
                Date Range
              </Text>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                format="DD/MM/YYYY"
              />
            </div>

            <Button type="primary" onClick={fetchReport} loading={loading}>
              Generate Report
            </Button>

            {reportData.length > 0 && (
              <>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={exportToExcel}
                  type="default"
                >
                  Excel
                </Button>
                <Button onClick={exportToPDF} type="default" danger>
                  PDF
                </Button>
              </>
            )}
          </Space>

          {reportData.length > 0 && (
            <Table
              columns={columns}
              dataSource={reportData}
              rowKey={
                viewMode === "sitewise"
                  ? "siteId"
                  : viewMode === "machinewise"
                    ? "machineId"
                    : "date"
              }
              loading={loading}
              pagination={{
                pageSize: 50,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} items`,
              }}
              size="small"
              summary={() => {
                const totals = calculateTotals();
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ fontWeight: "bold", background: "#fafafa" }}>
                      <Table.Summary.Cell index={0}>TOTAL</Table.Summary.Cell>
                      {viewMode === "machinewise" && (
                        <Table.Summary.Cell index={1}>-</Table.Summary.Cell>
                      )}
                      <Table.Summary.Cell>
                        {totals.totalMeter?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.totalCrawlerHSD?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.totalCompHSD?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.totalCamperHSD?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.totalTotalHSD?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.totalCrawlerRPM?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.totalCompRPM?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.hsdPerMeter?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.meterPerRPM?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.crawlerHSDPerRPM?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.compHSDPerRPM?.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell>{totals.totalHoles}</Table.Summary.Cell>
                      <Table.Summary.Cell>
                        {totals.avgDepth?.toFixed(2)}
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          )}

          {reportData.length === 0 && !loading && (
            <div className="text-center mt-8 text-gray-400">
              <p>Select filter options and click "Generate Report"</p>
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default SiteProductionReport;
