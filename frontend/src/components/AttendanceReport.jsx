import { useState, useEffect } from "react";
import {
    Button,
    Table,
    Tag,
    Select,
    Card,
    DatePicker,
    message,
    Typography,
    Divider,
    Modal,
    Statistic,
    Row,
    Col,
    Space
} from "antd";
import {
    FilePdfOutlined,
    FileExcelOutlined,
    SearchOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined
} from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AttendanceReport = () => {
    const [loading, setLoading] = useState(false);
    const [sites, setSites] = useState([]);
    const [selectedSite, setSelectedSite] = useState(null);
    const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
    const [reportData, setReportData] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [dates, setDates] = useState([]);

    // Detail Modal
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedEmployeeStats, setSelectedEmployeeStats] = useState(null);


    useEffect(() => {
        fetchSites();
    }, []);

    const fetchSites = async () => {
        try {
            const res = await api.get("/api/sites?limit=1000");
            setSites(res.data.data || []);
        } catch (err) {
            message.error("Failed to load sites");
        }
    };

    const generateDateArray = (start, end) => {
        const dates = [];
        let curr = start;
        while (curr.isBefore(end) || curr.isSame(end, 'day')) {
            dates.push(curr);
            curr = curr.add(1, 'day');
        }
        return dates;
    };

    const fetchReport = async () => {
        if (!selectedSite || !dateRange) {
            message.error("Please select a site and date range");
            return;
        }

        setLoading(true);
        try {
            const startDate = dateRange[0].format("YYYY-MM-DD");
            const endDate = dateRange[1].format("YYYY-MM-DD");
            const dateList = generateDateArray(dateRange[0], dateRange[1]);
            setDates(dateList);

            // Fetch Employees of the site
            const empRes = await api.get("/api/employeeLists?limit=1000");
            const siteEmps = (empRes.data.data || []).filter(e => e.siteId === selectedSite);

            // Fetch Attendance for the range and site
            const attRes = await api.get(`/api/employeeAttendance?startDate=${startDate}&endDate=${endDate}&siteId=${selectedSite}&limit=2000`);
            const attendanceRecords = attRes.data.data || [];

            // Process Data into Matrix
            // Row: Employee, Cols: Dates
            const processed = siteEmps.map(emp => {
                const empRecords = attendanceRecords.filter(r => r.employeeId === emp.id);
                const recordMap = {}; // Date -> Record
                empRecords.forEach(r => {
                    recordMap[dayjs(r.date).format("YYYY-MM-DD")] = r;
                });

                return {
                    ...emp,
                    records: recordMap,
                    stats: calculateEmployeeStats(emp, empRecords)
                };
            });

            setEmployees(siteEmps);
            setReportData(processed);

        } catch (err) {
            console.error(err);
            message.error("Failed to generate report");
        } finally {
            setLoading(false);
        }
    };

    const calculateEmployeeStats = (employee, records) => {
        // Stats within the selected period
        let present = 0;
        let absent = 0;
        let nonWorking = 0;
        let totalSalary = 0;

        records.forEach(r => {
            if (r.presence === 'present') present++;
            if (r.presence === 'absent') absent++;
            if (r.workStatus === 'non-working') nonWorking++; // Note: absent implies non-working usually but can be working & absent? No.
            totalSalary += Number(r.salary) || 0;
        });

        const advance = Number(employee.advancedAmount) || 0;
        // Calculated Net Pay Logic:
        // If Advance > Total Salary -> Deduct full salary from debt (virtually), Net Pay = 0, Remaining Advance = Advance - Salary
        // If Advance < Total Salary -> Deduct Advance from Salary, Net Pay = Salary - Advance, Remaining Advance = 0

        let netPay = 0;
        let advanceDeducted = 0;
        let remainingAdvance = advance;

        if (advance > 0) {
            if (advance >= totalSalary) {
                advanceDeducted = totalSalary;
                netPay = 0;
                remainingAdvance = advance - totalSalary;
            } else {
                advanceDeducted = advance;
                netPay = totalSalary - advance;
                remainingAdvance = 0;
            }
        } else {
            netPay = totalSalary;
        }

        return {
            present,
            absent,
            nonWorking,
            totalSalary,
            originalAdvance: advance,
            advanceDeducted,
            remainingAdvance,
            netPay
        };
    };

    const handleEmployeeClick = (record) => {
        setSelectedEmployee(record);
        setSelectedEmployeeStats(record.stats);
        setDetailModalVisible(true);
    };

    // Export to Excel
    const exportExcel = () => {
        if (reportData.length === 0) return;

        const data = reportData.map(emp => {
            const row = {
                "Employee ID": emp.empId,
                "Name": emp.name,
                "Designation": emp.designation,
                "Total Present": emp.stats.present,
                "Total Salary": emp.stats.totalSalary,
            };
            dates.forEach(d => {
                const dateStr = d.format("YYYY-MM-DD");
                const rec = emp.records[dateStr];
                row[d.format("DD/MM")] = rec ? (rec.presence === 'present' ? 'P' : 'A') : '-';
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `Attendance_Report_${dayjs().format("YYYYMMDD")}.xlsx`);
    };

    // Export to PDF
    const exportPDF = () => {
        if (reportData.length === 0) return;
        const doc = new jsPDF('l', 'mm', 'a4');

        doc.text(`Attendance Report - ${selectedSite ? sites.find(s => s.id === selectedSite)?.siteName : ''}`, 14, 15);
        doc.text(`Period: ${dateRange[0].format("DD/MM/YYYY")} - ${dateRange[1].format("DD/MM/YYYY")}`, 14, 22);

        const tableColumn = ["Emp ID", "Name", ...dates.map(d => d.format("DD/MM")), "Total (₹)"];
        const tableRows = reportData.map(emp => {
            return [
                emp.empId,
                emp.name,
                ...dates.map(d => {
                    const rec = emp.records[d.format("YYYY-MM-DD")];
                    if (!rec) return '-';
                    if (rec.presence === 'absent') return 'A';
                    if (rec.workStatus === 'non-working') return 'NW';
                    return 'P';
                }),
                emp.stats.totalSalary.toFixed(2)
            ];
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            styles: { fontSize: 8, cellPadding: 1 },
            headStyles: { fillColor: [22, 160, 133] },
        });

        doc.save(`Attendance_Report_${dayjs().format("YYYYMMDD")}.pdf`);
    };

    // Table Columns
    const columns = [
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            fixed: 'left',
            width: 150,
            render: (text, record) => <a onClick={() => handleEmployeeClick(record)}>{text}</a>
        },
        ...dates.map(date => ({
            title: date.format("DD"),
            key: date.format("YYYY-MM-DD"),
            width: 50,
            align: 'center',
            render: (_, record) => {
                const dateStr = date.format("YYYY-MM-DD");
                const att = record.records[dateStr];
                if (!att) return <span className="text-gray-300">-</span>;

                if (att.presence === 'absent') return <Tag color="red">A</Tag>;
                if (att.workStatus === 'non-working') return <Tag color="orange">NW</Tag>;
                return <Tag color="green">P</Tag>;
            }
        })),
        {
            title: "Total",
            key: "totalSalary",
            fixed: 'right',
            width: 100,
            render: (_, record) => <Text strong>₹{record.stats.totalSalary}</Text>
        }
    ];

    return (
        <div className="space-y-4">
            <Card>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="w-full md:w-1/4">
                        <Text strong>Select Site</Text>
                        <Select
                            placeholder="Select Site"
                            className="w-full mt-1"
                            onChange={setSelectedSite}
                            value={selectedSite}
                        >
                            {sites.map(s => <Select.Option key={s.id} value={s.id}>{s.siteName}</Select.Option>)}
                        </Select>
                    </div>
                    <div className="w-full md:w-1/4">
                        <Text strong>Date Range</Text>
                        <RangePicker
                            className="w-full mt-1"
                            value={dateRange}
                            onChange={setDateRange}
                            format="DD/MM/YYYY"
                        />
                    </div>
                    <div className="w-full md:w-1/4">
                        <Button type="primary" icon={<SearchOutlined />} onClick={fetchReport} block>
                            Generate Report
                        </Button>
                    </div>
                </div>
            </Card>

            {reportData.length > 0 && (
                <Card
                    title="Attendance Report"
                    extra={
                        <Space>
                            <Button icon={<FileExcelOutlined />} onClick={exportExcel} className="text-green-600 border-green-600">Excel</Button>
                            <Button icon={<FilePdfOutlined />} onClick={exportPDF} danger>PDF</Button>
                        </Space>
                    }
                >
                    <Table
                        dataSource={reportData}
                        columns={columns}
                        rowKey="id"
                        scroll={{ x: 1000 }}
                        pagination={false}
                        bordered
                        size="small"
                    />
                </Card>
            )}

            <Modal
                title={`Details for ${selectedEmployee?.name}`}
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={null}
                width={700}
            >
                {selectedEmployeeStats && (
                    <div className="py-4">
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Statistic title="Days Present" value={selectedEmployeeStats.present} prefix={<CheckCircleOutlined className="text-green-500" />} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Days Absent" value={selectedEmployeeStats.absent} prefix={<CloseCircleOutlined className="text-red-500" />} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Total Earnings" value={selectedEmployeeStats.totalSalary} prefix="₹" precision={2} />
                            </Col>
                        </Row>
                        <Divider />
                        <Title level={5}>Advance Deduction Calculation</Title>
                        <div className="bg-gray-50 p-4 rounded-md">
                            <Row gutter={[16, 8]}>
                                <Col span={12}><Text>Original Advance:</Text></Col>
                                <Col span={12} className="text-right"><Text strong>₹{selectedEmployeeStats.originalAdvance.toFixed(2)}</Text></Col>

                                <Col span={12}><Text type="danger">Less: Advance Adjusted:</Text></Col>
                                <Col span={12} className="text-right"><Text type="danger">- ₹{selectedEmployeeStats.advanceDeducted.toFixed(2)}</Text></Col>

                                <Col span={24}><Divider className="my-2" /></Col>

                                <Col span={12}><Text strong>Net Salary Payable:</Text></Col>
                                <Col span={12} className="text-right"><Text strong className="text-lg text-green-600">₹{selectedEmployeeStats.netPay.toFixed(2)}</Text></Col>

                                <Col span={12}><Text type="secondary">Remaining Advance:</Text></Col>
                                <Col span={12} className="text-right"><Text type="secondary">₹{selectedEmployeeStats.remainingAdvance.toFixed(2)}</Text></Col>
                            </Row>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AttendanceReport;
