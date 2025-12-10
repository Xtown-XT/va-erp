import React, { useState, useEffect } from "react";
import {
    Card,
    Table,
    DatePicker,
    Button,
    Select,
    Typography,
    Row,
    Col,
    Tag,
    message,
    Space,
    Modal
} from "antd";
import {
    SearchOutlined,
    FilePdfOutlined,
    FileExcelOutlined,
    EyeOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../service/api";
import * as XLSX from "xlsx";
import { truncateToFixed } from "../utils/textUtils";
import { useSites, useMachines, useEmployees } from "../hooks/useQueries";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const DailyEntryReport = () => {
    const [loading, setLoading] = useState(false);
    // Default to last 30 days or current month? User said "fetch all", but we need a default range or it will be too heavy?
    // User request "fetch and show from backend all daily entried data".
    // I will default to a wide range or no range?
    // Let's stick to empty date range (all time) or current month.
    // "fetch and show from backend all daily entried data" might imply NO date filter by default?
    // But backend requires valid pagination.
    // I will default to current month but allow clearing.
    const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
    const [data, setData] = useState([]); // This will hold the processed dailyData
    const [totals, setTotals] = useState({});
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);

    const [filters, setFilters] = useState({
        siteId: null,
        machineId: null,
        employeeId: null
    });

    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const { data: sites = [] } = useSites();
    const { data: machines = [] } = useMachines();
    const { data: employees = [] } = useEmployees();

    // Helper to calculate metrics (Copied from ProductionReport)
    const calculateProductionMetrics = (entries) => {
        let totalCrawlerHSD = 0;
        let totalCamperHSD = 0;
        let totalCompressorHSD = 0;
        let totalTotalHSD = 0;
        let totalMeter = 0;
        let totalCrawlerRPM = 0;
        let totalCompressorRPM = 0;
        let totalHoles = 0;

        const dailyData = entries.map(entry => {
            const machineHSD = parseFloat(entry.machineHSD) || 0;
            const meter = parseFloat(entry.meter) || 0;
            const machineRPM = (parseFloat(entry.machineClosingRPM) || 0) - (parseFloat(entry.machineOpeningRPM) || 0);
            const compressorRPM = (parseFloat(entry.compressorClosingRPM) || 0) - (parseFloat(entry.compressorOpeningRPM) || 0);
            const holes = parseFloat(entry.noOfHoles) || 0;
            const compressorHSD = parseFloat(entry.compressorHSD) || 0;

            const machineTypeSrc = (entry.machine?.machineType) || (machines.find(m => m.id === entry.machineId)?.machineType) || '';
            const machineType = machineTypeSrc.toString().trim().toLowerCase();
            const isCrawler = machineType === 'crawler' || machineType.includes('crawler');
            const isCamper = machineType === 'camper' || machineType.includes('camper') || machineType.includes('truck');

            let crawlerHSD = 0;
            let camperHSD = 0;
            let crawlerRPM = 0;

            if (isCrawler) {
                crawlerHSD = machineHSD;
                crawlerRPM = machineRPM;
            } else if (isCamper) {
                camperHSD = machineHSD;
            }

            const totalHSD = parseFloat((crawlerHSD + camperHSD + compressorHSD).toFixed(2));

            const hsdMtr = meter > 0 ? parseFloat((totalHSD / meter).toFixed(2)) : 0;
            const mtrRPM = compressorRPM > 0 ? parseFloat((meter / compressorRPM).toFixed(2)) : 0;
            const crawlerHsdPerRpm = crawlerRPM > 0 ? parseFloat((crawlerHSD / crawlerRPM).toFixed(2)) : 0;
            const compHsdPerRpm = compressorRPM > 0 ? parseFloat((compressorHSD / compressorRPM).toFixed(2)) : 0;
            const depthAvg = holes > 0 ? parseFloat((meter / holes).toFixed(2)) : 0;

            totalCrawlerHSD += crawlerHSD;
            totalCamperHSD += camperHSD;
            totalCompressorHSD += compressorHSD;
            totalTotalHSD += totalHSD;
            totalMeter += meter;
            totalCrawlerRPM += crawlerRPM;
            totalCompressorRPM += compressorRPM;
            totalHoles += holes;

            return {
                ...entry,
                site: entry.site,
                isCrawler,
                isCamper,
                crawlerHSD: parseFloat(crawlerHSD.toFixed(2)),
                camperHSD: parseFloat(camperHSD.toFixed(2)),
                compressorHSD: parseFloat(compressorHSD.toFixed(2)),
                totalHSD,
                meter,
                crawlerRPM,
                compressorRPM,
                hsdMtr,
                mtrRPM,
                crawlerHsdPerRpm,
                compHsdPerRpm,
                holes,
                depthAvg,
                crawlerHSDDisplay: isCrawler ? crawlerHSD : '-',
                camperHSDDisplay: isCamper ? camperHSD : '-',
                crawlerRPMDisplay: isCrawler ? crawlerRPM : '-',
            };
        });

        const totals = {
            totalCrawlerHSD: parseFloat(totalCrawlerHSD.toFixed(2)),
            totalCamperHSD: parseFloat(totalCamperHSD.toFixed(2)),
            totalCompressorHSD: parseFloat(totalCompressorHSD.toFixed(2)),
            totalTotalHSD: parseFloat(totalTotalHSD.toFixed(2)),
            totalMeter: parseFloat(totalMeter.toFixed(2)),
            totalCrawlerRPM: parseFloat(totalCrawlerRPM.toFixed(2)),
            totalCompressorRPM: parseFloat(totalCompressorRPM.toFixed(2)),
            totalHoles: parseFloat(totalHoles.toFixed(2)),
            totalHsdMtr: totalMeter > 0 ? parseFloat((totalTotalHSD / totalMeter).toFixed(2)) : 0,
            totalMtrRPM: totalCompressorRPM > 0 ? parseFloat((totalMeter / totalCompressorRPM).toFixed(2)) : 0,
            totalCrawlerHsdPerRpm: totalCrawlerRPM > 0 ? parseFloat((totalCrawlerHSD / totalCrawlerRPM).toFixed(2)) : 0,
            totalCompHsdPerRpm: totalCompressorRPM > 0 ? parseFloat((totalCompressorHSD / totalCompressorRPM).toFixed(2)) : 0,
            totalDepthAvg: totalHoles > 0 ? parseFloat((totalMeter / totalHoles).toFixed(2)) : 0,
        };

        return { dailyData, totals };
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const startDate = dateRange && dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : "";
            const endDate = dateRange && dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : "";

            const queryParams = new URLSearchParams({
                page,
                limit: pageSize,
                ...(startDate && { startDate }),
                ...(endDate && { endDate }),
                ...(filters.siteId && { siteId: filters.siteId }),
                ...(filters.machineId && { machineId: filters.machineId }),
                ...(filters.employeeId && { employeeId: filters.employeeId }),
            });

            const res = await api.get(`/api/dailyEntries?${queryParams.toString()}`);
            if (res.data.success) {
                const { dailyData, totals: calcTotals } = calculateProductionMetrics(res.data.data);
                setData(dailyData);
                setTotals(calcTotals);
                setTotal(res.data.total);
            }
        } catch (error) {
            message.error("Failed to fetch report");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch when filters or pagination change
    useEffect(() => {
        fetchReport();
    }, [page, pageSize, filters, dateRange]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); // Reset to page 1 on filter change
    };

    const exportToPDF = () => {
        const doc = new jsPDF("l", "pt", "a4");
        const title = `Daily Entry Report - ${dateRange[0].format("DD/MM/YYYY")} to ${dateRange[1].format("DD/MM/YYYY")}`;

        const tableColumn = [
            "Date", "Shift", "Site", "Meter", "Crawler HSD", "Comp HSD", "Camper HSD", "Total HSD",
            "Crawler RPM", "Comp RPM", "HSD/MTR", "MTR/RPM", "Crawler H/R", "Comp H/R", "Holes", "Depth"
        ];

        const tableRows = data.map(item => [
            dayjs(item.date).format("DD/MM/YYYY"),
            item.shift || 1,
            item.site?.siteName || sites.find(s => s.id === item.siteId)?.siteName || '-',
            truncateToFixed(item.meter || 0, 2),
            item.crawlerHSDDisplay,
            Math.round(item.compressorHSD || 0),
            item.camperHSDDisplay,
            Math.round(item.totalHSD || 0),
            item.crawlerRPMDisplay,
            truncateToFixed(item.compressorRPM || 0, 2),
            truncateToFixed(item.hsdMtr || 0, 2),
            truncateToFixed(item.mtrRPM || 0, 2),
            item.crawlerHsdPerRpm > 0 ? truncateToFixed(item.crawlerHsdPerRpm, 2) : '-',
            item.compHsdPerRpm > 0 ? truncateToFixed(item.compHsdPerRpm, 2) : '-',
            item.holes || 0,
            truncateToFixed(item.depthAvg || 0, 2)
        ]);

        // Add totals row
        const totalsRow = [
            "TOTAL", "", "",
            truncateToFixed(totals.totalMeter || 0, 2),
            Math.round(totals.totalCrawlerHSD || 0),
            Math.round(totals.totalCompressorHSD || 0),
            Math.round(totals.totalCamperHSD || 0),
            Math.round(totals.totalTotalHSD || 0),
            truncateToFixed(totals.totalCrawlerRPM || 0, 2),
            truncateToFixed(totals.totalCompressorRPM || 0, 2),
            truncateToFixed(totals.totalHsdMtr || 0, 2),
            truncateToFixed(totals.totalMtrRPM || 0, 2),
            totals.totalCrawlerHsdPerRpm > 0 ? truncateToFixed(totals.totalCrawlerHsdPerRpm, 2) : '-',
            totals.totalCompHsdPerRpm > 0 ? truncateToFixed(totals.totalCompHsdPerRpm, 2) : '-',
            totals.totalHoles || 0,
            truncateToFixed(totals.totalDepthAvg || 0, 2)
        ];
        tableRows.push(totalsRow);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: "grid",
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185] },
        });

        doc.text(title, 40, 30);
        doc.save(`Daily_Entry_Report_${dayjs().format("YYYYMMDD_HHmmss")}.pdf`);
    };

    const columns = [
        {
            title: "Date",
            dataIndex: "date",
            key: "date",
            // width: 100, // Removed fixed width
            render: (date) => dayjs(date).format("DD/MM/YYYY"),
        },
        {
            title: "Shift",
            dataIndex: "shift",
            key: "shift",
            // width: 60,
            render: (shift) => shift || 1,
        },
        {
            title: "Site",
            dataIndex: ["site", "siteName"],
            key: "site",
            // width: 150,
            render: (value, record) => {
                if (record.site?.siteName) return record.site.siteName;
                if (record.siteId) {
                    const site = sites.find(s => s.id === record.siteId);
                    return site?.siteName || '-';
                }
                return '-';
            },
        },
        {
            title: "Meter",
            dataIndex: "meter",
            key: "meter",
            // width: 80,
            render: (value) => truncateToFixed(value || 0, 2),
        },
        {
            title: "Crawler HSD",
            dataIndex: "crawlerHSDDisplay",
            key: "crawlerHSD",
            // width: 100,
            render: (value, record) => record.isCrawler ? Math.round(value || 0) : '-',
        },
        {
            title: "Comp HSD",
            dataIndex: "compressorHSD",
            key: "compressorHSD",
            // width: 100,
            render: (value) => Math.round(value || 0),
        },
        {
            title: "Camper HSD",
            dataIndex: "camperHSDDisplay",
            key: "camperHSD",
            // width: 100,
            render: (value, record) => record.isCamper ? Math.round(value || 0) : '-',
        },
        {
            title: "Total HSD",
            dataIndex: "totalHSD",
            key: "totalHSD",
            // width: 100,
            render: (value) => Math.round(value || 0),
        },
        {
            title: "Crawler RPM",
            dataIndex: "crawlerRPMDisplay",
            key: "crawlerRPM",
            // width: 100,
            render: (value, record) => record.isCrawler ? Number(value || 0).toFixed(2) : '-',
        },
        {
            title: "Comp RPM",
            dataIndex: "compressorRPM",
            key: "compressorRPM",
            // width: 100,
            render: (value) => truncateToFixed(value || 0, 2),
        },
        {
            title: "HSD/MTR",
            dataIndex: "hsdMtr",
            key: "hsdMtr",
            // width: 90,
            render: (value) => truncateToFixed(value || 0, 2),
        },
        {
            title: "MTR/RPM",
            dataIndex: "mtrRPM",
            key: "mtrRPM",
            // width: 90,
            render: (value) => truncateToFixed(value || 0, 2),
        },
        {
            title: "Crawler HSD/RPM",
            dataIndex: "crawlerHsdPerRpm",
            key: "crawlerHsdPerRpm",
            // width: 120,
            render: (value, record) => record.isCrawler && value > 0 ? truncateToFixed(value, 2) : '-',
        },
        {
            title: "Comp HSD/RPM",
            dataIndex: "compHsdPerRpm",
            key: "compHsdPerRpm",
            // width: 120,
            render: (value) => value > 0 ? truncateToFixed(value, 2) : '-',
        },
        {
            title: "No. Holes",
            dataIndex: "holes",
            key: "holes",
            // width: 80,
            render: (value) => value || 0,
        },
        {
            title: "Depth Avg",
            dataIndex: "depthAvg",
            key: "depthAvg",
            // width: 90,
            render: (value) => truncateToFixed(value || 0, 2),
        },
        {
            title: "Actions",
            key: "actions",
            // width: 80,
            // fixed: "right", // Removed fixed
            render: (_, record) => (
                <Button
                    icon={<EyeOutlined />}
                    size="small"
                    onClick={() => {
                        setSelectedEntry(record);
                        setShowDetailModal(true);
                    }}
                >
                    Detail
                </Button>
            ),
        },
    ];

    const exportExcel = () => {
        const sheetData = data.map(item => ({
            Date: dayjs(item.date).format("DD/MM/YYYY"),
            Shift: item.shift,
            Site: item.site?.siteName || sites.find(s => s.id === item.siteId)?.siteName || '-',
            Meter: truncateToFixed(item.meter || 0, 2),
            "Crawler HSD": item.crawlerHSDDisplay,
            "Compressor HSD": Math.round(item.compressorHSD || 0),
            "Camper HSD": item.camperHSDDisplay,
            "Total HSD": Math.round(item.totalHSD || 0),
            "Crawler RPM": item.crawlerRPMDisplay,
            "Compressor RPM": truncateToFixed(item.compressorRPM || 0, 2),
            "HSD/MTR": truncateToFixed(item.hsdMtr || 0, 2),
            "MTR/RPM": truncateToFixed(item.mtrRPM || 0, 2),
            "Crawler HSD/RPM": item.crawlerHsdPerRpm > 0 ? truncateToFixed(item.crawlerHsdPerRpm, 2) : '-',
            "Comp HSD/RPM": item.compHsdPerRpm > 0 ? truncateToFixed(item.compHsdPerRpm, 2) : '-',
            "Holes": item.holes || 0,
            "Depth Avg": truncateToFixed(item.depthAvg || 0, 2)
        }));

        const ws = XLSX.utils.json_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Daily Entries");
        XLSX.writeFile(wb, "Daily_Report.xlsx");
    };

    return (
        <div className="p-6">
            <Card>
                <div className="flex justify-between items-center mb-6">
                    <Title level={3} style={{ margin: 0 }}>Daily Entry Report</Title>
                    <Space>
                        <Button icon={<FileExcelOutlined />} onClick={exportExcel}>Excel</Button>
                        <Button icon={<FilePdfOutlined />} onClick={exportToPDF} danger>PDF</Button>
                    </Space>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <RangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        className="w-full"
                        format="DD/MM/YYYY"
                    />
                    <Select
                        placeholder="Filter by Site"
                        allowClear
                        className="w-full"
                        value={filters.siteId}
                        onChange={(val) => handleFilterChange('siteId', val)}
                    >
                        {sites.map(s => <Option key={s.id} value={s.id}>{s.siteName}</Option>)}
                    </Select>

                    <Select
                        placeholder="Filter by Machine"
                        allowClear
                        className="w-full"
                        value={filters.machineId}
                        onChange={(val) => handleFilterChange('machineId', val)}
                    >
                        {machines.map(m => <Option key={m.id} value={m.id}>{m.machineNumber}</Option>)}
                    </Select>

                    <Select
                        placeholder="Filter by Employee"
                        allowClear
                        className="w-full"
                        showSearch
                        optionFilterProp="children"
                        value={filters.employeeId}
                        onChange={(val) => handleFilterChange('employeeId', val)}
                    >
                        {employees.map(e => <Option key={e.id} value={e.id}>{e.name}</Option>)}
                    </Select>
                </div>

                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: page,
                        pageSize: pageSize,
                        total: total,
                        onChange: (p, s) => { setPage(p); setPageSize(s); },
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} entries`,
                        pageSizeOptions: ['10', '20', '50']
                    }}
                    bordered
                    size="small"
                    // scroll={{ x: 1500 }} // Removed scroll
                    summary={() => {
                        return (
                            <Table.Summary fixed>
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={1} />
                                    <Table.Summary.Cell index={2} />
                                    <Table.Summary.Cell index={3}><Text strong>{truncateToFixed(totals.totalMeter || 0, 2)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={4}><Text strong>{Math.round(totals.totalCrawlerHSD || 0)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={5}><Text strong>{Math.round(totals.totalCompressorHSD || 0)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={6}><Text strong>{Math.round(totals.totalCamperHSD || 0)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={7}><Text strong>{Math.round(totals.totalTotalHSD || 0)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={8}><Text strong>{truncateToFixed(totals.totalCrawlerRPM || 0, 2)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={9}><Text strong>{truncateToFixed(totals.totalCompressorRPM || 0, 2)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={10}><Text strong>{truncateToFixed(totals.totalHsdMtr || 0, 2)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={11}><Text strong>{truncateToFixed(totals.totalMtrRPM || 0, 2)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={12}><Text strong>{totals.totalCrawlerHsdPerRpm > 0 ? truncateToFixed(totals.totalCrawlerHsdPerRpm, 2) : '-'}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={13}><Text strong>{totals.totalCompHsdPerRpm > 0 ? truncateToFixed(totals.totalCompHsdPerRpm, 2) : '-'}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={14}><Text strong>{totals.totalHoles || 0}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={15}><Text strong>{truncateToFixed(totals.totalDepthAvg || 0, 2)}</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={16} />
                                </Table.Summary.Row>
                            </Table.Summary>
                        );
                    }}
                />
            </Card>

            {/* Detail Modal */}
            <Modal
                title={
                    <Space>
                        <EyeOutlined />
                        <span>Entry Details</span>
                    </Space>
                }
                open={showDetailModal}
                onCancel={() => {
                    setShowDetailModal(false);
                    setSelectedEntry(null);
                }}
                footer={[
                    <Button key="close" onClick={() => setShowDetailModal(false)}>
                        Close
                    </Button>
                ]}
                width={800}
            >
                {selectedEntry && (
                    <div>
                        <Card size="small" style={{ marginBottom: 16 }}>
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Text strong>Date:</Text>
                                    <div>{dayjs(selectedEntry.date).format('DD MMM YYYY')}</div>
                                </Col>
                                <Col span={6}>
                                    <Text strong>Shift:</Text>
                                    <div><Tag>{selectedEntry.shift || 1}</Tag></div>
                                </Col>
                                <Col span={6}>
                                    <Text strong>Site:</Text>
                                    <div>{selectedEntry.site?.siteName || '-'}</div>
                                </Col>
                            </Row>
                        </Card>
                        <Title level={5}>Employees</Title>
                        <Table
                            dataSource={selectedEntry.employees || []}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            columns={[
                                { title: 'Name', dataIndex: 'name', key: 'name' },
                                { title: 'Role', key: 'role', render: (_, r) => r.role || r.DailyEntryEmployee?.role || 'operator' },
                                { title: 'Shift', key: 'shift', render: (_, r) => r.shift || r.DailyEntryEmployee?.shift || 1 }
                            ]}
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default DailyEntryReport;
