import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Table,
  Tag,
  Space,
  Form,
  Select,
  Card,
  Popconfirm,
  DatePicker,
  InputNumber,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Divider,
  Alert
} from "antd";
import {
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SearchOutlined
} from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const Attendance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());

  // Data State
  const [employees, setEmployees] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // Map<employeeId, attendanceRecord>
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize
  useEffect(() => {
    fetchSites();
  }, []);

  // Fetch Sites
  const fetchSites = async () => {
    try {
      const res = await api.get("/api/sites?limit=1000");
      setSites(res.data.data || []);
    } catch (err) {
      console.error(err);
      message.error("Failed to load sites");
    }
  };

  // Fetch Data when Site or Date changes
  useEffect(() => {
    if (selectedSite && selectedDate) {
      fetchAttendanceData();
    } else {
      setEmployees([]);
      setAttendanceMap({});
    }
  }, [selectedSite, selectedDate]);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Employees for Site
      const empRes = await api.get("/api/employeeLists?limit=1000");
      const allEmps = empRes.data.data || [];
      const siteEmps = allEmps.filter(e => e.siteId === selectedSite && e.status === 'active');

      // 2. Fetch Existing Attendance for Date and Site
      const dateStr = selectedDate.format("YYYY-MM-DD");
      const attRes = await api.get(`/api/employeeAttendance?date=${dateStr}&siteId=${selectedSite}&limit=1000`);
      const existingAttendance = attRes.data.data || [];

      // 3. Merge Data
      const attMap = {};
      existingAttendance.forEach(att => {
        attMap[att.employeeId] = att;
      });

      // Prepare Initial State for UI
      const initialMap = {};

      siteEmps.forEach(emp => {
        if (attMap[emp.id]) {
          initialMap[emp.id] = {
            ...attMap[emp.id],
            isNew: false,
            salary: Number(attMap[emp.id].salary)
          };
        } else {
          initialMap[emp.id] = {
            employeeId: emp.id,
            date: dateStr,
            siteId: selectedSite,
            presence: 'present',
            workStatus: 'working',
            salary: Number(emp.dailySalary) || 0,
            isNew: true
          };
        }
      });

      setEmployees(siteEmps);
      setAttendanceMap(initialMap);
      setHasChanges(false);

    } catch (err) {
      console.error(err);
      message.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  // Handle Input Changes
  const handleAttendanceChange = (employeeId, field, value) => {
    setAttendanceMap(prev => {
      const current = prev[employeeId];
      const next = { ...current, [field]: value };

      // Business Logic: 
      // If Absent -> Salary = 0, Status = Non-working
      if (field === 'presence') {
        if (value === 'absent') {
          next.salary = 0;
          next.workStatus = 'non-working';
        } else {
          // If toggled back to present, restore salary from employee master
          const emp = employees.find(e => e.id === employeeId);
          if (emp) next.salary = Number(emp.dailySalary) || 0;
          next.workStatus = 'working';
        }
      }

      return { ...prev, [employeeId]: next };
    });
    setHasChanges(true);
  };

  // Save Function
  const handleSave = async () => {
    setSaving(true);
    try {
      const recordsToSave = Object.values(attendanceMap).map(record => ({
        ...record,
        date: selectedDate.format("YYYY-MM-DD"), // Ensure date matches
        siteId: selectedSite
      }));

      // Use the new batch upsert endpoint
      await api.put("/api/employeeAttendance/upsert-batch", { records: recordsToSave });

      message.success("Attendance saved successfully!");
      setHasChanges(false);

      // Refresh data 
      await fetchAttendanceData();

    } catch (err) {
      console.error(err);
      message.error("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  // Statistics
  const stats = {
    total: employees.length,
    present: Object.values(attendanceMap).filter(r => r.presence === 'present').length,
    absent: Object.values(attendanceMap).filter(r => r.presence === 'absent').length,
    saved: Object.values(attendanceMap).filter(r => !r.isNew).length
  };

  const allSaved = stats.saved === stats.total && stats.total > 0 && !hasChanges;

  // Columns
  const columns = [
    {
      title: "Emp ID",
      dataIndex: "empId",
      key: "empId",
      width: 100,
      render: (text) => <span className="text-gray-600 font-medium">{text}</span>
    },
    {
      title: "Employee",
      dataIndex: "name",
      key: "name",
      width: 200,
      render: (text, record) => (
        <div>
          <div className="font-semibold">{text}</div>
          <div className="text-xs text-gray-500">{record.designation}</div>
        </div>
      )
    },
    {
      title: "Presence",
      key: "presence",
      width: 120,
      render: (_, record) => {
        const att = attendanceMap[record.id];
        return (
          <Select
            value={att?.presence}
            onChange={(val) => handleAttendanceChange(record.id, 'presence', val)}
            className="w-full"
            style={{ fontWeight: "bold" }}
          >
            <Select.Option value="present" className="text-green-600">Present</Select.Option>
            <Select.Option value="absent" className="text-red-500">Absent</Select.Option>
          </Select>
        );
      }
    },
    {
      title: "Work Status",
      key: "workStatus",
      width: 140,
      render: (_, record) => {
        const att = attendanceMap[record.id];
        return (
          <Select
            value={att?.workStatus}
            onChange={(val) => handleAttendanceChange(record.id, 'workStatus', val)}
            className="w-full"
            disabled={att?.presence === 'absent'}
          >
            <Select.Option value="working">Working</Select.Option>
            <Select.Option value="non-working">Non-Working</Select.Option>
          </Select>
        );
      }
    },
    {
      title: "Salary (₹)",
      key: "salary",
      width: 120,
      render: (_, record) => {
        const att = attendanceMap[record.id];
        return (
          <InputNumber
            value={att?.salary}
            onChange={(val) => handleAttendanceChange(record.id, 'salary', val)}
            min={0}
            className="w-full"
            disabled={att?.presence === 'absent'}
          />
        );
      }
    },
    {
      title: "Advance Info",
      key: "advance",
      render: (_, record) => {
        const adv = record.advancedAmount || 0;
        return adv > 0 ? (
          <Tag color="volcano">Adv: ₹{adv}</Tag>
        ) : (
          <span className="text-gray-400">-</span>
        );
      }
    }
  ];


  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-1/3">
            <Text strong>Select Site</Text>
            <Select
              placeholder="Select a Site"
              className="w-full mt-1"
              showSearch
              optionFilterProp="children"
              onChange={setSelectedSite}
              value={selectedSite}
            >
              {sites.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.siteName}</Select.Option>
              ))}
            </Select>
          </div>
          <div className="w-full md:w-1/3">
            <Text strong>Select Date</Text>
            <DatePicker
              className="w-full mt-1"
              value={selectedDate}
              onChange={setSelectedDate}
              format="DD/MM/YYYY"
              allowClear={false}
            />
          </div>
          <div className="w-full md:w-1/3">
            {selectedSite && selectedDate && (
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={fetchAttendanceData}
                block
              >
                Reload List
              </Button>
            )}
          </div>
        </div>
      </Card>

      {selectedSite && (
        <>
          {allSaved ? (
            <Alert
              message={`Attendance Saved for ${selectedDate.format("DD/MM/YYYY")}`}
              description="All records for this site have been saved."
              type="success"
              showIcon
              className="mb-4"
            />
          ) : null}

          <Card
            title={
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span>Attendance Marking</span>
                <div className="flex gap-2 text-sm font-normal">
                  <Tag color="blue">Total: {stats.total}</Tag>
                  <Tag color="green">Present: {stats.present}</Tag>
                  <Tag color="red">Absent: {stats.absent}</Tag>
                </div>
              </div>
            }
            extra={
              <Space>
                <Button
                  onClick={() => navigate('/reports/attendance')}
                  icon={<SearchOutlined />}
                >
                  View Report
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={employees.length === 0}
                >
                  Save All Changes
                </Button>
              </Space>
            }
            bodyStyle={{ padding: 0 }}
          >
            <Table
              dataSource={employees}
              columns={columns}
              rowKey="id"
              pagination={false}
              loading={loading}
              scroll={{ x: 800 }}
              size="middle"
              className="overflow-x-auto"
            />
          </Card>
        </>
      )}

      {!selectedSite && (
        <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Text className="text-gray-400 text-lg">Please select a Site and Date to mark attendance</Text>
        </div>
      )}
    </div>
  );
};

export default Attendance;
