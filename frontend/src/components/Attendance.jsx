import { useState, useEffect } from "react";
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
} from "antd";
import {
  SaveOutlined,
  FilePdfOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import { canEdit, canDelete } from "../service/auth";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const Attendance = () => {
  const [form] = Form.useForm();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [sites, setSites] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [attendanceData, setAttendanceData] = useState({});
  const [modifiedEmployees, setModifiedEmployees] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // View attendance states
  const [viewDate, setViewDate] = useState(dayjs());
  const [viewSite, setViewSite] = useState('');
  const [viewRecords, setViewRecords] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewPagination, setViewPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
  });
  // Inline edit state for View table
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineEdit, setInlineEdit] = useState(null);
  const [inlineSaving, setInlineSaving] = useState(false);

  const [presenceFilter, setPresenceFilter] = useState(null)

  // Fetch attendance records for selected date (for adding attendance)
  const fetchRecords = async (date = selectedDate) => {
    setLoading(true);
    try {
      const dateStr = date.format("YYYY-MM-DD");
      const res = await api.get(`/api/employeeAttendance?date=${dateStr}&limit=1000`);
      setRecords(res.data.data || []);

      // Initialize attendance data for all employees
      const initialData = {};
      employees.forEach(emp => {
        const existingRecord = res.data.data?.find(r => r.employeeId === emp.id);
        initialData[emp.id] = {
          presence: existingRecord?.presence || 'present',
          workStatus: existingRecord?.workStatus || 'working',
          salary: existingRecord?.salary || 0,
          siteId: existingRecord?.siteId || '',
          vehicleId: existingRecord?.vehicleId || '',
          recordId: existingRecord?.id || null
        };
      });
      setAttendanceData(initialData);
      // Clear modified employees when fetching new records
      setModifiedEmployees(new Set());
    } catch (err) {
      message.error("Error fetching attendance");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch attendance records for viewing
  const fetchViewRecords = async (date = viewDate, siteId = viewSite, page = 1, limit = 10) => {
    setViewLoading(true);
    try {
      const dateStr = date.format("YYYY-MM-DD");

      let url = `/api/employeeAttendance?date=${dateStr}&page=${page}&limit=${limit}`;
      if (siteId) {
        url += `&siteId=${siteId}`;
      }

      const res = await api.get(url);
      const records = res.data.data || [];

      setViewRecords(records);

      // Update pagination state
      setViewPagination(prev => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
      }));
    } catch (err) {
      message.error("Error fetching attendance records");
      setViewRecords([]);
    } finally {
      setViewLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      // Fetch all employees without pagination limit
      const res = await api.get("/api/employeeLists?limit=1000");
      setEmployees(res.data.data || []);
      console.log("Total employees loaded:", res.data.data?.length || 0);
    } catch (err) {
      message.error("Error fetching employees");
    }
  };



  const fetchSites = async () => {
    try {
      const res = await api.get("/api/sites?limit=1000");
      setSites(res.data.data || []);
    } catch (err) {
      message.error("Error fetching sites");
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await api.get("/api/vehicles?limit=1000");
      setVehicles(res.data.data || []);
    } catch (err) {
      message.error("Error fetching vehicles");
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchEmployees(),
        fetchSites(),
        fetchVehicles()
      ]);
      // fetchRecords();
      fetchViewRecords(viewDate, viewSite, viewPagination.current, viewPagination.pageSize);
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (employees.length > 0 && selectedDate) {
      fetchRecords();
    }
  }, [employees.length, selectedDate]);

  // Update attendance data for an employee
  // const updateAttendanceData = (employeeId, field, value) => {
  //   setAttendanceData(prev => {
  //     const prevEntry = prev[employeeId] || {};
  //     const nextEntry = { ...prevEntry, [field]: value };

  //     // Business rule: if absent, force non-working (but allow salary to be set manually)
  //     if (field === 'presence' && value === 'absent') {
  //       nextEntry.workStatus = 'non-working';
  //     }

  //     return {
  //       ...prev,
  //       [employeeId]: nextEntry,
  //     };
  //   });
    
  //   // Track that this employee has been modified
  //   setModifiedEmployees(prev => new Set(prev).add(employeeId));
  // };

  // Save all attendance records with batch processing
  // const saveAllAttendance = async () => {
  //   setSaving(true);
  //   const hideLoading = message.loading('Saving attendance records...', 0);
    
  //   try {
  //     const currentUser = localStorage.getItem("username") || "Unknown";
  //     const dateStr = selectedDate.format("YYYY-MM-DD");

  //     // Save ALL employees in attendanceData
  //     // const entriesToSave = Object.entries(attendanceData);

  //     const entriesToSave = Array.from(modifiedEmployees).map(employeeId => [employeeId, attendanceData[employeeId]]);


  //     let successCount = 0;
  //     let failCount = 0;
  //     const failedEmployees = [];
  //     const batchSize = 20; 
  //     const totalRecords = entriesToSave.length;

  //     if (totalRecords === 0) {
  //       hideLoading();
  //       message.info('No changes to save. Modify attendance data before saving.');
  //       setSaving(false);
  //       return;
  //     }

  //     console.log(`Starting to save ${totalRecords} attendance records in batches of ${batchSize}`);

  //     // Process in batches with delay to avoid overwhelming the server
  //     for (let i = 0; i < entriesToSave.length; i += batchSize) {
  //       const batch = entriesToSave.slice(i, i + batchSize);
  //       const batchNumber = Math.floor(i / batchSize) + 1;
  //       const totalBatches = Math.ceil(entriesToSave.length / batchSize);
  //       const progress = Math.round((i / totalRecords) * 100);
        
  //       console.log(`Processing batch ${batchNumber}/${totalBatches} (${progress}% complete)`);
        
  //       const batchPromises = batch.map(async ([employeeId, data]) => {
  //         const emp = employees.find(e => e.id === employeeId);
  //         const empName = emp?.name || employeeId;
          
  //         try {
  //           const payload = {
  //             employeeId,
  //             presence: data.presence || 'present',
  //             workStatus: data.workStatus || 'working',
  //             salary: Number(data.salary) || 0,
  //             date: dateStr,
  //             siteId: data.siteId || null,
  //             vehicleId: data.vehicleId || null,
  //           };

  //           if (data.recordId) {
  //             // Update existing record
  //             payload.updatedBy = currentUser;
  //             await api.put(`/api/employeeAttendance/${data.recordId}`, payload);
  //           } else {
  //             // Create new record
  //             payload.createdBy = currentUser;
  //             await api.post("/api/employeeAttendance", payload);
  //           }
  //           return { success: true, employeeId, name: empName };
  //         } catch (error) {
  //           console.error(`✗ Failed to save ${empName}:`, error.response?.data || error.message);
  //           return { success: false, employeeId, name: empName, error: error.message };
  //         }
  //       });

  //       const results = await Promise.all(batchPromises);
  //       const batchSuccess = results.filter(r => r.success).length;
  //       const batchFail = results.filter(r => !r.success).length;
        
  //       successCount += batchSuccess;
  //       failCount += batchFail;
        
  //       // Track failed employees
  //       results.filter(r => !r.success).forEach(r => {
  //         failedEmployees.push({
  //           name: r.name,
  //           id: r.employeeId,
  //           error: r.error
  //         });
  //       });
        
  //       console.log(`Batch ${batchNumber} completed: ${batchSuccess} success, ${batchFail} failed (${Math.round(((i + batch.length) / totalRecords) * 100)}% done)`);
        
  //       // Add small delay between batches to prevent transaction conflicts
  //       if (i + batchSize < entriesToSave.length) {
  //         await new Promise(resolve => setTimeout(resolve, 50));
  //       }
  //     }

  //     hideLoading();

  //     // Clear modified employees set after successful save
  //     setModifiedEmployees(new Set());

  //     if (failCount > 0) {
  //       message.warning({
  //         content: `Saved ${successCount} records. ${failCount} failed. Check console for details.`,
  //         duration: 5
  //       });
  //       console.error('Failed employees details:', failedEmployees);
  //     } else {
  //       message.success(`All ${successCount} attendance records saved successfully!`);
  //     }

  //     // Refresh attendance and employees to reflect updated remaining amounts
  //     await fetchRecords();
  //     await fetchEmployees();
  //     await fetchViewRecords(viewDate, viewSite, viewPagination.current, viewPagination.pageSize);

  //   } catch (err) {
  //     hideLoading();
  //     console.error("Error saving attendance:", err);
  //     message.error("Error saving attendance");
  //   } finally {
  //     setSaving(false);
  //   }
  // };

  // Track modified employees safely
const updateAttendanceData = (employeeId, field, value) => {
  setAttendanceData(prev => {
    const prevEntry = prev[employeeId] || {};
    const nextEntry = { ...prevEntry, [field]: value };
    if (field === 'presence' && value === 'absent') {
      nextEntry.workStatus = 'non-working';
    }
    return { ...prev, [employeeId]: nextEntry };
  });

  setModifiedEmployees(prev => new Set([...prev, employeeId])); // <- important
};

// Save function with debug
const saveAllAttendance = async () => {
  if (modifiedEmployees.size === 0) {
    message.info("No changes to save.");
    return;
  }

  setSaving(true);
  const hideLoading = message.loading('Saving attendance records...', 0);
  const currentUser = localStorage.getItem("username") || "Unknown";
  const dateStr = selectedDate.format("YYYY-MM-DD");

  try {
    const entriesToSave = Array.from(modifiedEmployees)
      .map(empId => [empId, attendanceData[empId]])
      .filter(([_, data]) => data); // <- ensure data exists

    console.log('Saving entries:', entriesToSave); // <-- debug

    for (let [employeeId, data] of entriesToSave) {
      const payload = {
        employeeId,
        presence: data.presence || 'present',
        workStatus: data.workStatus || 'working',
        salary: Number(data.salary) || 0,
        date: dateStr,
        siteId: data.siteId || null,
        vehicleId: data.vehicleId || null,
      };

      if (data.recordId) payload.updatedBy = currentUser;
      else payload.createdBy = currentUser;

      try {
        if (data.recordId) await api.put(`/api/employeeAttendance/${data.recordId}`, payload);
        else await api.post("/api/employeeAttendance", payload);
      } catch (err) {
        console.error(`Failed to save employee ${employeeId}:`, err.response?.data || err.message);
      }
    }

    hideLoading();
    message.success(`Saved ${entriesToSave.length} attendance records successfully!`);
    setModifiedEmployees(new Set());
    await fetchRecords(selectedDate);
  } catch (err) {
    hideLoading();
    console.error(err);
    message.error("Error saving attendance");
  } finally {
    setSaving(false);
  }
};


  // Handle individual record edit
  const handleEdit = (record) => {
    if (!record || !record.id || !record.employeeId) {
      message.error("Invalid record to edit");
      return;
    }
    setInlineEditId(record.id);
    setExpandedRowKeys([record.id]);
    setInlineEdit({
      id: record.id,
      employeeId: record.employeeId,
      date: record.date,
      presence: record.presence || 'present',
      workStatus: record.workStatus || 'working',
      salary: record.salary || 0,
      siteId: record.siteId || '',
      vehicleId: record.vehicleId || '',
    });
  };

  const handleInlineField = (field, value) => {
    setInlineEdit(prev => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      if (field === 'presence' && value === 'absent') {
        next.workStatus = 'non-working';
      }
      return next;
    });
  };

  const handleInlineCancel = () => {
    setInlineEditId(null);
    setInlineEdit(null);
    setExpandedRowKeys([]);
  };

  const handleInlineSave = async () => {
    if (!inlineEdit || !inlineEdit.id) return;
    setInlineSaving(true);
    try {
      const payload = {
        employeeId: inlineEdit.employeeId,
        presence: inlineEdit.presence,
        workStatus: inlineEdit.workStatus,
        salary: Number(inlineEdit.salary) || 0,
        date: dayjs(inlineEdit.date).format('YYYY-MM-DD'),
        siteId: inlineEdit.siteId || null,
        vehicleId: inlineEdit.vehicleId || null,
      };
      await api.put(`/api/employeeAttendance/${inlineEdit.id}`, payload);
      message.success('Attendance updated');
      handleInlineCancel();
      await fetchViewRecords(viewDate, viewSite, viewPagination.current, viewPagination.pageSize);
      await fetchEmployees();
    } catch (e) {
      message.error('Failed to update attendance');
    } finally {
      setInlineSaving(false);
    }
  };

  // Handle hard delete
  const handleDelete = async (id) => {
    try {
      if (!id) {
        message.error("Missing record id for delete");
        return;
      }
      await api.delete(`/api/employeeAttendance/${id}/hard`);
      message.success("Record deleted successfully");
      fetchRecords();
      fetchViewRecords(viewDate, viewSite, viewPagination.current, viewPagination.pageSize);
    } catch (err) {
      message.error("Error deleting record");
    }
  };

  // Get all employees for adding attendance (no filters)
  const getFilteredEmployees = () => {
    return employees;
  };

  // Handle view table change
  const handleViewTableChange = (pagination) => {
    setViewPagination(prev => ({
      ...prev,
      current: pagination.current,
      pageSize: pagination.pageSize,
    }));

    fetchViewRecords(viewDate, viewSite, pagination.current, pagination.pageSize);
  };


  // PDF Export for view records
  const exportToPDF = async () => {

    const dateStr = viewDate.format("YYYY-MM-DD");
    const siteId = viewSite;
    if (siteId) url += `&siteId=${siteId}`;

    const selectedSiteName = viewSite ? sites.find(s => s.id === viewSite)?.siteName : 'All Sites';

    const res = await api.get("/api/employeeAttendance?page=1&limit=1000");
    const allRecords = res.data.data || [];

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Attendance Records - ${viewDate.format("DD/MM/YYYY")}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
            .filters { margin-bottom: 20px; }
            .filter-item { margin: 5px 0; }
            .status-present { color: green; font-weight: bold; }
            .status-absent { color: red; font-weight: bold; }
            .status-working { color: blue; font-weight: bold; }
            .status-non-working { color: orange; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Attendance Records</h1>
            <p>Date: ${viewDate.format("DD/MM/YYYY")}</p>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="filters">
            <h3>Filters Applied:</h3>
            <div class="filter-item"><strong>Site:</strong> ${selectedSiteName}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Emp ID</th>
                <th>Presence</th>
                <th>Work Status</th>
                <th>Salary</th>
                <th>Site</th>
                <th>Vehicle</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${allRecords
            // viewRecords
        .map(record => {
          const employee = employees.find(emp => emp.id === record.employeeId);
          const site = sites.find(s => s.id === record.siteId);
          const vehicle = vehicles.find(v => v.id === record.vehicleId);
          return `
                    <tr>
                      <td>${employee?.name || "-"}</td>
                      <td>${employee?.empId || "-"}</td>
                      <td class="status-${record.presence}">${record.presence || "-"}</td>
                      <td class="status-${record.workStatus?.replace('-', '')}">${record.workStatus || "-"}</td>
                      <td>₹${record.salary?.toLocaleString() || 0}</td>
                      <td>${site?.siteName || "-"}</td>
                      <td>${vehicle ? `${vehicle.vehicleNumber} (${vehicle.vehicleType})` : "-"}</td>
                      <td>${dayjs(record.date).format('DD/MM/YYYY')}</td>
                    </tr>`;
        })
        .join("")}
            </tbody>
          </table>
          <div style="margin-top: 20px; text-align: center; color: #666;">
            <p>Total Records: ${allRecords.length}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Calculate statistics based on all employees
  const allEmployees = getFilteredEmployees();
  const presentCount = allEmployees.filter(emp => attendanceData[emp.id]?.presence === 'present').length;
  const workingCount = allEmployees.filter(emp => attendanceData[emp.id]?.workStatus === 'working').length;
  const totalEmployees = allEmployees.length;
  const attendancePercentage = totalEmployees > 0 ? (presentCount / totalEmployees) * 100 : 0;

  // Calculate saved attendance statistics
  const savedAttendanceCount = allEmployees.filter(emp => {
    const data = attendanceData[emp.id] || {};
    return data.recordId !== null && data.recordId !== undefined;
  }).length;
  const pendingAttendanceCount = totalEmployees - savedAttendanceCount;

  // Table columns for viewing attendance records
  const viewColumns = [
    {
      title: "Employee",
      key: "employeeName",
      render: (_, record) => {
        const employee = employees.find(emp => emp.id === record.employeeId);
        return (
          <div>
            <div className="font-medium">{employee?.name || 'Unknown'}</div>
            <div className="text-sm text-gray-500">ID: {employee?.empId || 'N/A'}</div>
          </div>
        );
      },
    },
    {
      title: "Presence",
      key: "presence",
      render: (_, record) => (
        <Tag color={record.presence === 'present' ? 'green' : 'red'}>
          {record.presence === 'present' ? (
            <><CheckCircleOutlined /> Present</>
          ) : (
            <><CloseCircleOutlined /> Absent</>
          )}
        </Tag>
      ),
    },
    {
      title: "Work Status",
      key: "workStatus",
      render: (_, record) => (
        <Tag color={record.workStatus === 'working' ? 'blue' : 'orange'}>
          {record.workStatus ? record.workStatus.charAt(0).toUpperCase() + record.workStatus.slice(1) : "-" || 'N/A'}
        </Tag>
      ),
    },
    {
      title: "Salary",
      key: "salary",
      render: (_, record) => (
        <Text strong>₹{record.salary?.toLocaleString() || 0}</Text>
      ),
    },
    {
      title: "Advance Amount",
      key: "advancedAmount",
      render: (_, record) => {
        const employee = employees.find(emp => emp.id === record.employeeId);
        const advance = employee?.advancedAmount || 0;
        return (
          <Text
            strong
            style={{ color: advance > 0 ? '#ff4d4f' : '#52c41a' }}
          >
            ₹{advance.toLocaleString()}
          </Text>
        );
      },
    },
    {
      title: "Site",
      key: "site",
      render: (_, record) => {
        const site = sites.find(s => s.id === record.siteId);
        return <Text>{site?.siteName || '-'}</Text>;
      },
    },
    {
      title: "Vehicle",
      key: "vehicle",
      render: (_, record) => {
        const vehicle = vehicles.find(v => v.id === record.vehicleId);
        return <Text>{vehicle ? `${vehicle.vehicleNumber} (${vehicle.vehicleType})` : '-'}</Text>;
      },
    },
    {
      title: "Date",
      key: "date",
      render: (_, record) => (
        <Text>{dayjs(record.date).format('DD/MM/YYYY')}</Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          {canEdit() && (
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >

            </Button>
          )}
          {canDelete() && (
       
             <Popconfirm
              title="Are you sure to delete this record permanently?"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button icon={<DeleteOutlined />} danger />
            </Popconfirm>
   
          )}
        </Space>
      ),
    },
  ];

  const renderInlineEditor = (record) => {
    if (!inlineEdit || inlineEditId !== record.id) return null;
    return (
      <div className="bg-gray-50 rounded-md p-4">
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Text strong>Date</Text>
            <DatePicker
              className="w-full mt-1"
              value={dayjs(inlineEdit.date)}
              onChange={(d) => handleInlineField('date', d)}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col xs={24} sm={6}>
            <Text strong>Presence</Text>
            <Select
              className="w-full mt-1"
              value={inlineEdit.presence}
              onChange={(v) => handleInlineField('presence', v)}
            >
              <Select.Option value="present">Present</Select.Option>
              <Select.Option value="absent">Absent</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Text strong>Work Status</Text>
            <Select
              className="w-full mt-1"
              value={inlineEdit.workStatus}
              onChange={(v) => handleInlineField('workStatus', v)}
              disabled={inlineEdit.presence === 'absent'}
            >
              <Select.Option value="working">Working</Select.Option>
              <Select.Option value="non-working">Non-working</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={4}>
            <Text strong>Salary</Text>
            <InputNumber
              className="w-full mt-1"
              value={inlineEdit.salary}
              onChange={(v) => handleInlineField('salary', v)}
              min={0}
              step={0.01}
              precision={2}
              formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/₹\s?|(,*)/g, '')}
            />
          </Col>
        </Row>
        <Row gutter={12} className="mt-3">
          <Col xs={24} sm={12}>
            <Text strong>Site</Text>
            <Select
              className="w-full mt-1"
              value={inlineEdit.siteId || ''}
              onChange={(v) => handleInlineField('siteId', v)}
              allowClear
            >
              {sites.map(site => (
                <Select.Option key={site.id} value={site.id}>{site.siteName}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12}>
            <Text strong>Vehicle</Text>
            <Select
              className="w-full mt-1"
              value={inlineEdit.vehicleId || ''}
              onChange={(v) => handleInlineField('vehicleId', v)}
              allowClear
            >
              {vehicles.map(vehicle => (
                <Select.Option key={vehicle.id} value={vehicle.id}>
                  {vehicle.vehicleNumber} ({vehicle.vehicleType})
                </Select.Option>
              ))}
            </Select>
          </Col>
        </Row>
        <div className="mt-4 flex gap-2">
          <Button type="primary" onClick={handleInlineSave} loading={inlineSaving}>Save</Button>
          <Button onClick={handleInlineCancel}>Cancel</Button>
        </div>
      </div>
    );
  };

  // Table columns for the new list-based system
  const columns = [
    {
      title: "Employee",
      key: "employeeName",
      render: (_, employee) => {
        const data = attendanceData[employee.id] || {};
        const hasAttendanceSaved = data.recordId !== null && data.recordId !== undefined;
        const isPresent = data.presence === 'present';

        return (
          <div
            style={{
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: hasAttendanceSaved
                ? (isPresent ? '#f6ffed' : '#fff2f0')
                : 'transparent',
              border: hasAttendanceSaved
                ? `2px solid ${isPresent ? '#52c41a' : '#ff4d4f'}`
                : '2px solid transparent'
            }}
          >
            <div
              className="font-medium"
              style={{
                color: hasAttendanceSaved
                  ? (isPresent ? '#52c41a' : '#ff4d4f')
                  : 'inherit'
              }}
            >
              {employee.name}
              {hasAttendanceSaved && (
                <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                  {isPresent ? '✓ Present' : '✗ Absent'}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">ID: {employee.empId}</div>
          </div>
        );
      },
    },
    {
      title: "Presence",
      key: "presence",
      render: (_, employee) => {
        const data = attendanceData[employee.id] || {};
        return (
          <Select
            value={data.presence || 'present'}
            onChange={(value) => updateAttendanceData(employee.id, 'presence', value)}
            style={{ width: 120 }}
            size="small"
          >
            <Select.Option value="present">
              <CheckCircleOutlined style={{ color: 'green' }} /> Present
            </Select.Option>
            <Select.Option value="absent">
              <CloseCircleOutlined style={{ color: 'red' }} /> Absent
            </Select.Option>
          </Select>
        );
      },
    },
    {
      title: "Work Status",
      key: "workStatus",
      render: (_, employee) => {
        const data = attendanceData[employee.id] || {};
        return (
          <Select
            value={data.workStatus || 'working'}
            onChange={(value) => updateAttendanceData(employee.id, 'workStatus', value)}
            style={{ width: 120 }}
            size="small"
            disabled={(attendanceData[employee.id]?.presence || 'present') === 'absent'}
          >
            <Select.Option value="working">Working</Select.Option>
            <Select.Option value="non-working">Non-working</Select.Option>
          </Select>
        );
      },
    },
    {
      title: "Salary",
      key: "salary",
      render: (_, employee) => {
        const data = attendanceData[employee.id] || {};
        return (
          <InputNumber
            value={data.salary || 0}
            onChange={(value) => updateAttendanceData(employee.id, 'salary', value)}
            style={{ width: 100 }}
            size="small"
            min={0}
            step={0.01}
            precision={2}
            formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/₹\s?|(,*)/g, '')}
          />
        );
      },
    },
    {
      title: "Site",
      key: "site",
      render: (_, employee) => {
        const data = attendanceData[employee.id] || {};
        return (
          <Select
            value={data.siteId || ''}
            onChange={(value) => updateAttendanceData(employee.id, 'siteId', value)}
            style={{ width: 150 }}
            size="small"
            placeholder="Select site"
            allowClear
          >
            {sites.map(site => (
              <Select.Option key={site.id} value={site.id}>
                {site.siteName}
              </Select.Option>
            ))}
          </Select>
        );
      },
    },
    {
      title: "Vehicle",
      key: "vehicle",
      render: (_, employee) => {
        const data = attendanceData[employee.id] || {};
        return (
          <Select
            value={data.vehicleId || ''}
            onChange={(value) => updateAttendanceData(employee.id, 'vehicleId', value)}
            style={{ width: 150 }}
            size="small"
            placeholder="Select vehicle"
            allowClear
          >
            {vehicles.map(vehicle => (
              <Select.Option key={vehicle.id} value={vehicle.id}>
                {vehicle.vehicleNumber} ({vehicle.vehicleType})
              </Select.Option>
            ))}
          </Select>
        );
      },
    },
    {
      title: "Advance Amount",
      key: "advancedAmount",
      render: (_, employee) => {
        const advance = employee.advancedAmount || 0;
        return (
          <Text
            strong
            style={{
              color: advance > 0 ? '#ff4d4f' : '#52c41a',
              backgroundColor: advance > 0 ? '#fff2f0' : '#f6ffed',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            ₹{advance.toLocaleString()}
          </Text>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      {/* SECTION 1: ADD ATTENDANCE */}
      <div className="bg-white rounded-lg p-6">
        <div className="mb-6">
          <Title level={2} className="mb-2">Mark Daily Attendance</Title>
          <Text type="secondary">Mark attendance for all employees for the selected date</Text>
        </div>

        {/* Date Selection and Statistics */}
        <Card className="mb-6">
          <Row gutter={16} align="middle">
            <Col xs={24} sm={8}>
              <Text strong>Select Date:</Text>
              <DatePicker
                className="w-full mt-1"
                value={selectedDate}
                onChange={(date) => {
                  setSelectedDate(date);
                  fetchRecords(date);
                }}
                format="DD/MM/YYYY"
                style={{ marginBottom: 10 }}
              />
              <div className="flex flex-col mt-2">
                <Text strong >Search Employee:</Text>
                <Input.Search
                  placeholder="Search By Employee Name or ID"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ maxWidth: 300 }}
                />
              </div>


              <div>

                <div className="flex flex-col mt-2">
                  <Text strong>Select Presence:</Text>
                  <Select
                    placeholder="Filter by Presence"
                    allowClear
                    value={presenceFilter}
                    onChange={(value) => setPresenceFilter(value)}
                    style={{ maxWidth: 300 }}
                  >
                    <Select.Option value="present">Present</Select.Option>
                    <Select.Option value="absent">Absent</Select.Option>

                  </Select>
                </div>


                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setPresenceFilter(null);
                  }}
                  disabled={!searchTerm && !presenceFilter}

                  style={{ marginTop: 10 }}
                >
                  Clear Filters
                </Button>
              </div>

            </Col>

            <Col xs={24} sm={16}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="Total Employees"
                    value={totalEmployees}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Present"
                    value={presentCount}
                    valueStyle={{ color: '#3f8600' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Working"
                    value={workingCount}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Attendance %"
                    value={Math.round(attendancePercentage)}
                    suffix="%"
                    valueStyle={{
                      color: attendancePercentage >= 80 ? '#3f8600' :
                        attendancePercentage >= 60 ? '#faad14' : '#cf1322'
                    }}
                  />
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: '16px' }}>
                <Col span={6}>
                  <Statistic
                    title="Saved Today"
                    value={savedAttendanceCount}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Pending"
                    value={pendingAttendanceCount}
                    valueStyle={{ color: '#faad14' }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <div style={{
                    padding: '8px 16px',
                    backgroundColor: savedAttendanceCount > 0 ? '#f6ffed' : '#fff7e6',
                    border: `1px solid ${savedAttendanceCount > 0 ? '#52c41a' : '#faad14'}`,
                    borderRadius: '4px',
                    textAlign: 'center'
                  }}>
                    <Text style={{
                      color: savedAttendanceCount > 0 ? '#52c41a' : '#faad14',
                      fontWeight: 'bold'
                    }}>
                      {savedAttendanceCount > 0
                        ? `✓ ${savedAttendanceCount} Employees have attendance saved for today`
                        : 'No attendance saved for today yet'
                      }
                    </Text>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>


        {/* Attendance Table for Adding */}
        <Table
          columns={columns}
          dataSource={(allEmployees || []).filter((e) => {

            const searchMatch = String(e.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              String(e.empId)?.toLowerCase().includes(searchTerm.toLowerCase());

            const presenceMatch = presenceFilter ?
              (attendanceData[e.id]?.presence || 'present') === presenceFilter
              : true;

            return searchMatch && presenceMatch;

          }
          )}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['20', '50', '100', '150'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} employees`
          }}
          scroll={{ x: 1000 }}
          size="small"
          className="attendance-table"
        />

        {/* Save Button at Bottom */}
        {canEdit() && (
          <div className="mt-6 text-center">
            <Space size="large">
              <Button
                icon={<SaveOutlined />}
                onClick={saveAllAttendance}
                type="primary"
                loading={saving}
                size="large"
                className="min-w-[200px]"
              >
                Save All Attendance
              </Button>
            </Space>
          </div>
        )}
      </div>

      {/* SECTION 2: VIEW ATTENDANCE RECORDS */}
      <div className="bg-white rounded-lg p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title level={2} className="mb-2">View Attendance Records</Title>
            <Text type="secondary">View attendance records for any date with site filtering</Text>
          </div>
          <Button
            icon={<FilePdfOutlined />}
            onClick={exportToPDF}
            type="primary"
            danger
          >
            Export PDF
          </Button>
        </div>

        {/* View Filters */}
        <Card className="mb-6">
          <Row gutter={16} align="middle">
            <Col xs={24} sm={8}>
              <Text strong>Select Date to View:</Text>
              <DatePicker
                className="w-full mt-1"
                value={viewDate}
                onChange={(date) => {
                  setViewDate(date);
                  fetchViewRecords(date, viewSite, viewPagination.current, viewPagination.pageSize);
                }}
                format="DD/MM/YYYY"
              />
            </Col>
            <Col xs={24} sm={8}>
              <Text strong>Filter by Site:</Text>
              <Select
                className="w-full mt-1"
                placeholder="Select site to filter"
                value={viewSite}
                onChange={(siteId) => {
                  setViewSite(siteId);
                  fetchViewRecords(viewDate, siteId, viewPagination.current, viewPagination.pageSize);
                }}
                allowClear
              >
                {sites.map(site => (
                  <Select.Option key={site.id} value={site.id}>
                    {site.siteName}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={8}>

              <Text strong >Search Employee:</Text>
              <Input.Search
                placeholder="Search By Employee Name or ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: 300 }}
              />

            </Col>
            <Col xs={24} sm={8}>
              <div className="flex flex-col mt-2">
                <Text strong>Select Presence:</Text>
                <Select
                  placeholder="Filter by Presence"
                  allowClear
                  value={presenceFilter}
                  onChange={(value) => setPresenceFilter(value)}
                  style={{ maxWidth: 300 }}
                >
                  <Select.Option value="present">Present</Select.Option>
                  <Select.Option value="absent">Absent</Select.Option>

                </Select>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <Text strong>Actions:</Text>
              <div className="mt-1">
                <Button
                  onClick={() => {
                    setViewSite('');
                    setSearchTerm('');

                    fetchViewRecords(viewDate, '', viewPagination.current, viewPagination.pageSize);
                  }}
                  className="w-full"
                  icon={<ClearOutlined />}
                >
                  Clear Filters
                </Button>
              </div>
            </Col>
          </Row>
          {(viewSite) && (
            <div className="mt-4">
              <Text type="secondary">
                Showing records for {sites.find(s => s.id === viewSite)?.siteName} on {viewDate.format('DD/MM/YYYY')}
              </Text>
            </div>
          )}
        </Card>

        {/* View Records Table with inline editor */}
        <Table
          columns={viewColumns}
          // dataSource={(viewRecords || []).filter((v) => {

          //   const searchMatch = String(v.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          //     v.empId?.toLowerCase().includes(searchTerm.toLowerCase());

          //   const presenceMatch = presenceFilter ?
          //     (attendanceData[v.id]?.presence || 'present') === presenceFilter
          //     : true;

          //   return searchMatch && presenceMatch;

          // }

          dataSource={(viewRecords || []).filter((v) => {
            const employee = employees.find(emp => emp.id === v.employeeId);

            const searchMatch = searchTerm
              ? (employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                employee?.empId?.toLowerCase().includes(searchTerm.toLowerCase()))
              : true;

            const presenceMatch = presenceFilter ? (v.presence === presenceFilter) : true;

            return searchMatch && presenceMatch;
          })}


          rowKey="id"
          loading={viewLoading}
          pagination={{
            ...viewPagination,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`
          }}
          scroll={{ x: 1000 }}
          size="small"
          className="view-attendance-table"
          onChange={handleViewTableChange}
          expandable={{
            expandedRowKeys,
            onExpand: (expanded, record) => {
              if (!expanded) {
                handleInlineCancel();
              } else {
                handleEdit(record);
              }
            },
            expandedRowRender: (record) => renderInlineEditor(record),
          }}
        />

      </div>
    </div>
  );
};

export default Attendance;


