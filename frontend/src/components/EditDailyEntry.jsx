import { useState, useEffect } from "react";
import {
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  Switch,
  Card,
  DatePicker,
  Alert,
  message,
  Row,
  Col,
  Typography,
  Divider,
} from "antd";
import {
  CloseOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";
import { truncateToFixed } from "../utils/textUtils";
import { 
  useSites, 
  useVehicles, 
  useCompressors, 
  useEmployees,
} from "../hooks/useQueries";
import { useUpdateDailyEntry } from "../hooks/useMutations";

const { Title, Text } = Typography;

const EditDailyEntry = ({ visible, onCancel, onSuccess, shift1EntryId, shift2EntryId, entries }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  
  const { data: sites = [] } = useSites();
  const { data: machines = [] } = useVehicles();
  const { data: compressors = [] } = useCompressors();
  const { data: employees = [] } = useEmployees();
  
  const updateDailyEntry = useUpdateDailyEntry();
  
  // Shift 1 state
  const [shift1Data, setShift1Data] = useState({
    siteId: null,
    vehicleId: null,
    compressorId: null,
    vehicleOpeningRPM: null,
    vehicleClosingRPM: null,
    compressorOpeningRPM: null,
    compressorClosingRPM: null,
    vehicleHSD: null,
    compressorHSD: null,
    dieselUsed: null,
    noOfHoles: null,
    meter: null,
    employees: [],
    machineSpares: [],
    compressorSpares: [],
    drillingTools: [],
  });
  
  // Shift 2 state  
  const [shift2Data, setShift2Data] = useState({
    siteId: null,
    vehicleId: null,
    compressorId: null,
    vehicleOpeningRPM: null,
    vehicleClosingRPM: null,
    compressorOpeningRPM: null,
    compressorClosingRPM: null,
    vehicleHSD: null,
    compressorHSD: null,
    dieselUsed: null,
    noOfHoles: null,
    meter: null,
    employees: [],
    machineSpares: [],
    compressorSpares: [],
    drillingTools: [],
  });
  
  const [shift1Enabled, setShift1Enabled] = useState(true);
  const [shift2Enabled, setShift2Enabled] = useState(false);
  const [selectedShift1Machine, setSelectedShift1Machine] = useState(null);
  const [selectedShift2Machine, setSelectedShift2Machine] = useState(null);
  const [selectedShift1Compressor, setSelectedShift1Compressor] = useState(null);
  const [selectedShift2Compressor, setSelectedShift2Compressor] = useState(null);

  // Load entry data when modal opens (only load the shift that was clicked)
  useEffect(() => {
    if (visible && (shift1EntryId || shift2EntryId)) {
      loadEntryData();
    }
  }, [visible, shift1EntryId, shift2EntryId]);

  const loadEntryData = async () => {
    setLoading(true);
    try {
      let shift1Entry = null;
      let shift2Entry = null;

      // Only fetch the entry for the shift that was clicked
      if (shift1EntryId) {
        const res1 = await api.get(`/api/dailyEntries/${shift1EntryId}`);
        shift1Entry = res1.data.data;
      }

      if (shift2EntryId) {
        const res2 = await api.get(`/api/dailyEntries/${shift2EntryId}`);
        shift2Entry = res2.data.data;
      }

      // Set date
      if (shift1Entry?.date) {
        setSelectedDate(dayjs(shift1Entry.date));
      } else if (shift2Entry?.date) {
        setSelectedDate(dayjs(shift2Entry.date));
      }

      // Load Shift 1 data
      if (shift1Entry) {
        const machine = machines.find(m => m.id === shift1Entry.vehicleId);
        setSelectedShift1Machine(machine);
        
        if (shift1Entry.compressorId) {
          try {
            const compressorRes = await api.get(`/api/compressors/${shift1Entry.compressorId}`);
            const compressor = compressorRes.data.data;
            setSelectedShift1Compressor(compressor);
          } catch (error) {
            const compressor = compressors.find(c => c.id === shift1Entry.compressorId);
            setSelectedShift1Compressor(compressor);
          }
        }

        const shift1Employees = (shift1Entry.employees || [])
          .filter(emp => (emp.shift || emp.DailyEntryEmployee?.shift || 1) === 1)
          .map((emp, index) => ({
            id: Date.now() + index,
            employeeId: emp.id,
            role: emp.role || emp.DailyEntryEmployee?.role || 'operator',
          }));

        if (shift1Employees.length === 0) {
          shift1Employees.push(
            { id: Date.now(), role: 'operator', employeeId: null },
            { id: Date.now() + 1, role: 'helper', employeeId: null }
          );
        }

        setShift1Data({
          siteId: shift1Entry.siteId,
          vehicleId: shift1Entry.vehicleId,
          compressorId: shift1Entry.compressorId || null,
          vehicleOpeningRPM: shift1Entry.vehicleOpeningRPM ?? null,
          vehicleClosingRPM: shift1Entry.vehicleClosingRPM ?? null,
          compressorOpeningRPM: shift1Entry.compressorOpeningRPM ?? null,
          compressorClosingRPM: shift1Entry.compressorClosingRPM ?? null,
          vehicleHSD: shift1Entry.vehicleHSD ?? null,
          compressorHSD: shift1Entry.compressorHSD ?? null,
          dieselUsed: shift1Entry.dieselUsed ?? null,
          noOfHoles: shift1Entry.noOfHoles ?? null,
          meter: shift1Entry.meter ?? null,
          employees: shift1Employees,
          machineSpares: [],
          compressorSpares: [],
          drillingTools: [],
        });
        setShift1Enabled(true);
      } else {
        setShift1Enabled(false);
      }

      // Load Shift 2 data (only if shift2EntryId was provided)
      if (shift2Entry) {
        const machine = machines.find(m => m.id === shift2Entry.vehicleId);
        setSelectedShift2Machine(machine);
        
        const compressorId = shift2Entry.compressorId || shift1Entry?.compressorId;
        if (compressorId) {
          try {
            const compressorRes = await api.get(`/api/compressors/${compressorId}`);
            const compressor = compressorRes.data.data;
            setSelectedShift2Compressor(compressor);
          } catch (error) {
            const compressor = compressors.find(c => c.id === compressorId);
            setSelectedShift2Compressor(compressor);
          }
        }

        const shift2Employees = (shift2Entry.employees || [])
          .filter(emp => (emp.shift || emp.DailyEntryEmployee?.shift || 2) === 2)
          .map((emp, index) => ({
            id: Date.now() + 1000 + index,
            employeeId: emp.id,
            role: emp.role || emp.DailyEntryEmployee?.role || 'operator',
          }));

        if (shift2Employees.length === 0) {
          shift2Employees.push(
            { id: Date.now() + 1000, role: 'operator', employeeId: null },
            { id: Date.now() + 1001, role: 'helper', employeeId: null }
          );
        }

        setShift2Data({
          siteId: shift2Entry.siteId || shift1Entry?.siteId || null,
          vehicleId: shift2Entry.vehicleId || shift1Entry?.vehicleId || null,
          compressorId: shift2Entry.compressorId || shift1Entry?.compressorId || null,
          vehicleOpeningRPM: shift2Entry.vehicleOpeningRPM ?? null,
          vehicleClosingRPM: shift2Entry.vehicleClosingRPM ?? null,
          compressorOpeningRPM: shift2Entry.compressorOpeningRPM ?? null,
          compressorClosingRPM: shift2Entry.compressorClosingRPM ?? null,
          vehicleHSD: shift2Entry.vehicleHSD ?? null,
          compressorHSD: shift2Entry.compressorHSD ?? null,
          dieselUsed: shift2Entry.dieselUsed ?? null,
          noOfHoles: shift2Entry.noOfHoles ?? null,
          meter: shift2Entry.meter ?? null,
          employees: shift2Employees,
          machineSpares: [],
          compressorSpares: [],
          drillingTools: [],
        });
        setShift2Enabled(true);
      } else {
        // Don't enable Shift 2 if it wasn't clicked
        setShift2Enabled(false);
      }

      message.success("Entry loaded for editing");
    } catch (error) {
      console.error("Error loading entry for edit:", error);
      message.error("Failed to load entry for editing");
    } finally {
      setLoading(false);
    }
  };

  // Handle machine change - NO AUTO-FILL in edit mode
  const handleMachineChange = (machineId, shift) => {
    const machine = machines.find(m => m.id === machineId);
    
    if (shift === 1) {
      setSelectedShift1Machine(machine);
      setShift1Data(prev => ({
        ...prev,
        vehicleId: machineId,
        compressorId: machine?.compressorId || null,
        // DO NOT auto-fill opening RPM - keep existing values
      }));
      
      if (machine?.compressorId) {
        const compressor = compressors.find(c => c.id === machine.compressorId);
        setSelectedShift1Compressor(compressor);
        // DO NOT auto-fill compressor opening RPM
      } else {
        setSelectedShift1Compressor(null);
      }
      
      // Sync to Shift 2
      setSelectedShift2Machine(machine);
      setShift2Data(prev => ({
        ...prev,
        vehicleId: machineId,
        compressorId: machine?.compressorId || null,
        siteId: shift1Data.siteId || prev.siteId,
      }));
      
      if (machine?.compressorId) {
        const compressor = compressors.find(c => c.id === machine.compressorId);
        setSelectedShift2Compressor(compressor);
      } else {
        setSelectedShift2Compressor(null);
      }
    } else {
      setSelectedShift2Machine(machine);
      setShift2Data(prev => ({
        ...prev,
        vehicleId: machineId,
        compressorId: machine?.compressorId || null,
        // DO NOT auto-fill opening RPM
      }));
      
      if (machine?.compressorId) {
        const compressor = compressors.find(c => c.id === machine.compressorId);
        setSelectedShift2Compressor(compressor);
      } else {
        setSelectedShift2Compressor(null);
      }
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const shift2SiteId = shift2Data.siteId || shift1Data.siteId;
      const shift2VehicleId = shift2Data.vehicleId || shift1Data.vehicleId;
      const shift2CompressorId = shift2Data.compressorId || shift1Data.compressorId;

      const cleanPayload = (payload) => {
        const cleaned = { ...payload };
        if (cleaned.siteId === null) delete cleaned.siteId;
        if (cleaned.vehicleId === null) delete cleaned.vehicleId;
        if (cleaned.compressorId === null) delete cleaned.compressorId;
        return cleaned;
      };

      // Save Shift 1
      if (shift1Enabled && shift1EntryId) {
        const payload1 = cleanPayload({
          date: dateStr,
          shift: 1,
          siteId: shift1Data.siteId,
          vehicleId: shift1Data.vehicleId,
          compressorId: shift1Data.compressorId,
          vehicleOpeningRPM: shift1Data.vehicleOpeningRPM ?? 0,
          vehicleClosingRPM: shift1Data.vehicleClosingRPM ?? 0,
          compressorOpeningRPM: shift1Data.compressorOpeningRPM ?? 0,
          compressorClosingRPM: shift1Data.compressorClosingRPM ?? 0,
          dieselUsed: shift1Data.dieselUsed ?? 0,
          vehicleHSD: shift1Data.vehicleHSD ?? 0,
          compressorHSD: shift1Data.compressorHSD ?? 0,
          noOfHoles: shift1Data.noOfHoles ?? 0,
          meter: shift1Data.meter ?? 0,
          employees: shift1Data.employees
            .filter(e => e.employeeId)
            .map(e => ({ employeeId: e.employeeId, role: e.role, shift: 1 })),
          notes: "",
          machineSpares: shift1Data.machineSpares || [],
          compressorSpares: shift1Data.compressorSpares || [],
          drillingTools: shift1Data.drillingTools || [],
        });
        
        await updateDailyEntry.mutateAsync({ id: shift1EntryId, ...payload1 });
      }

      // Save Shift 2 (only if it was being edited)
      if (shift2Enabled && shift2EntryId) {
        const payload2 = cleanPayload({
          date: dateStr,
          shift: 2,
          siteId: shift2SiteId,
          vehicleId: shift2VehicleId,
          compressorId: shift2CompressorId,
          vehicleOpeningRPM: shift2Data.vehicleOpeningRPM ?? 0,
          vehicleClosingRPM: shift2Data.vehicleClosingRPM ?? 0,
          compressorOpeningRPM: shift2Data.compressorOpeningRPM ?? 0,
          compressorClosingRPM: shift2Data.compressorClosingRPM ?? 0,
          dieselUsed: shift2Data.dieselUsed ?? 0,
          vehicleHSD: shift2Data.vehicleHSD ?? 0,
          compressorHSD: shift2Data.compressorHSD ?? 0,
          noOfHoles: shift2Data.noOfHoles ?? 0,
          meter: shift2Data.meter ?? 0,
          employees: shift2Data.employees
            .filter(e => e.employeeId)
            .map(e => ({ employeeId: e.employeeId, role: e.role, shift: 2 })),
          notes: "",
          machineSpares: shift2Data.machineSpares || [],
          compressorSpares: shift2Data.compressorSpares || [],
          drillingTools: shift2Data.drillingTools || [],
        });
        
        await updateDailyEntry.mutateAsync({ id: shift2EntryId, ...payload2 });
      }


      message.success("Entry updated successfully");
      onSuccess?.();
      onCancel();
    } catch (error) {
      message.error(`Failed to update entry: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const updateShiftData = (shift, field, value) => {
    if (shift === 1) {
      setShift1Data(prev => ({ ...prev, [field]: value }));
    } else {
      setShift2Data(prev => ({ ...prev, [field]: value }));
    }
  };

  // Add employee to shift
  const addEmployeeToShift = (shift) => {
    const newEmployee = { id: Date.now(), role: 'operator', employeeId: null };
    if (shift === 1) {
      setShift1Data(prev => ({
        ...prev,
        employees: [...prev.employees, newEmployee],
      }));
    } else {
      setShift2Data(prev => ({
        ...prev,
        employees: [...prev.employees, newEmployee],
      }));
    }
  };

  // Remove employee from shift
  const removeEmployeeFromShift = (shift, empId) => {
    if (shift === 1) {
      setShift1Data(prev => ({
        ...prev,
        employees: prev.employees.filter(e => e.id !== empId),
      }));
    } else {
      setShift2Data(prev => ({
        ...prev,
        employees: prev.employees.filter(e => e.id !== empId),
      }));
    }
  };

  // Update employee in shift
  const updateEmployeeInShift = (shift, empId, field, value) => {
    if (shift === 1) {
      setShift1Data(prev => ({
        ...prev,
        employees: prev.employees.map(e => 
          e.id === empId ? { ...e, [field]: value } : e
        ),
      }));
    } else {
      setShift2Data(prev => ({
        ...prev,
        employees: prev.employees.map(e => 
          e.id === empId ? { ...e, [field]: value } : e
        ),
      }));
    }
  };

  const filteredMachines = machines.filter(m => 
    !shift1Data.siteId || m.siteId === shift1Data.siteId
  );

  return (
    <Modal
      title="Edit Daily Entry"
      open={visible}
      onCancel={onCancel}
      width={1200}
      footer={null}
      destroyOnClose
    >
      <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {/* Header Row - Date, Site, Machine, Compressor, Shift (all disabled) */}
        <Card className="mb-2">
          <Row gutter={16}>
            <Col xs={24} sm={6}>
              <Text strong>Date</Text>
              <DatePicker
                className="w-full mt-1"
                value={selectedDate}
                format="DD/MM/YYYY"
                disabled
              />
            </Col>
            <Col xs={24} sm={6}>
              <Text strong>Site</Text>
              <Select
                className="w-full mt-1"
                value={shift1Enabled ? shift1Data.siteId : shift2Data.siteId}
                disabled
              >
                {sites.map(site => (
                  <Select.Option key={site.id} value={site.id}>
                    {site.siteName}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={6}>
              <Text strong>Machine</Text>
              <Select
                className="w-full mt-1"
                value={shift1Enabled ? shift1Data.vehicleId : shift2Data.vehicleId}
                disabled
              >
                {machines.map(machine => (
                  <Select.Option key={machine.id} value={machine.id}>
                    {machine.vehicleType} ({machine.vehicleNumber})
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={3}>
              <Text strong>Compressor</Text>
              <Select
                className="w-full mt-1"
                value={shift1Enabled ? shift1Data.compressorId : shift2Data.compressorId}
                disabled
              >
                {compressors.map(compressor => (
                  <Select.Option key={compressor.id} value={compressor.id}>
                    {compressor.compressorName}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={3}>
              <Text strong>Shift</Text>
              <InputNumber
                className="w-full mt-1"
                value={shift1Enabled ? 1 : 2}
                disabled
                min={1}
                max={2}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
        </Card>

        {/* Shift 1 Section */}
        {shift1Enabled && (
          <Card className="mb-4">
            <Row gutter={16} style={{ marginTop: 0 }}>
              <Col xs={24} sm={12}>
                <Card title="Machine RPM" size="small">
                  <Row gutter={8}>
                    <Col span={12}>
                      <Text strong>Opening</Text>
                      <InputNumber
                        className="w-full mt-1"
                        value={shift1Data.vehicleOpeningRPM}
                        onChange={(value) => updateShiftData(1, 'vehicleOpeningRPM', value)}
                        min={0}
                        step={0.1}
                        precision={1}
                        controls={false}
                      />
                    </Col>
                    <Col span={12}>
                      <Text strong>Closing</Text>
                      <InputNumber
                        className="w-full mt-1"
                        value={shift1Data.vehicleClosingRPM}
                        onChange={(value) => updateShiftData(1, 'vehicleClosingRPM', value)}
                        min={0}
                        step={0.1}
                        precision={1}
                        controls={false}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card title="Compressor RPM" size="small">
                  <Row gutter={8}>
                    <Col span={12}>
                      <Text strong>Opening</Text>
                      <InputNumber
                        className="w-full mt-1"
                        value={shift1Data.compressorOpeningRPM}
                        onChange={(value) => updateShiftData(1, 'compressorOpeningRPM', value)}
                        min={0}
                        step={0.1}
                        precision={1}
                        controls={false}
                      />
                    </Col>
                    <Col span={12}>
                      <Text strong>Closing</Text>
                      <InputNumber
                        className="w-full mt-1"
                        value={shift1Data.compressorClosingRPM}
                        onChange={(value) => updateShiftData(1, 'compressorClosingRPM', value)}
                        min={0}
                        step={0.1}
                        precision={1}
                        controls={false}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col xs={24} sm={6}>
                <Text strong>HSD (Machine)</Text>
                <InputNumber
                  className="w-full mt-1"
                  value={shift1Data.vehicleHSD}
                  onChange={(value) => updateShiftData(1, 'vehicleHSD', value)}
                  min={0}
                  step={0.1}
                  precision={2}
                  controls={false}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Text strong>HSD (Compressor)</Text>
                <InputNumber
                  className="w-full mt-1"
                  value={shift1Data.compressorHSD}
                  onChange={(value) => updateShiftData(1, 'compressorHSD', value)}
                  min={0}
                  step={0.1}
                  precision={2}
                  controls={false}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Text strong>Meter</Text>
                <InputNumber
                  className="w-full mt-1"
                  value={shift1Data.meter}
                  onChange={(value) => updateShiftData(1, 'meter', value)}
                  min={0}
                  step={0.1}
                  precision={2}
                  controls={false}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Text strong>No. of Holes</Text>
                <InputNumber
                  className="w-full mt-1"
                  value={shift1Data.noOfHoles}
                  onChange={(value) => updateShiftData(1, 'noOfHoles', value)}
                  min={0}
                  step={1}
                  controls={false}
                />
              </Col>
            </Row>

            {/* Employees Section */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>Employees</Text>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => addEmployeeToShift(1)}
                >
                  Add Employee
                </Button>
              </div>
              {shift1Data.employees.map((emp) => (
                <Row gutter={16} key={emp.id} style={{ marginBottom: 8 }}>
                  <Col xs={24} sm={8}>
                    <Select
                      placeholder="Select role"
                      value={emp.role}
                      onChange={(value) => updateEmployeeInShift(1, emp.id, 'role', value)}
                      className="w-full"
                      size="small"
                    >
                      <Select.Option value="operator">Operator</Select.Option>
                      <Select.Option value="helper">Helper</Select.Option>
                    </Select>
                  </Col>
                  <Col xs={24} sm={14}>
                    <Select
                      placeholder={`Select ${emp.role}`}
                      value={emp.employeeId}
                      onChange={(value) => updateEmployeeInShift(1, emp.id, 'employeeId', value)}
                      showSearch
                      optionFilterProp="children"
                      className="w-full"
                      size="small"
                    >
                      {employees.map(employee => (
                        <Select.Option key={employee.id} value={employee.id}>
                          {employee.name} ({employee.empId}){employee.designation ? ` - ${employee.designation}` : ''}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col xs={24} sm={2}>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeEmployeeFromShift(1, emp.id)}
                    />
                  </Col>
                </Row>
              ))}
            </div>
          </Card>
        )}

        {/* Shift 2 Section */}
        {shift2Enabled && (
          <Card className="mb-4">
            <Row gutter={16} style={{ marginTop: 0 }}>
              <Col xs={24} sm={12}>
                <Card title="Machine RPM" size="small">
                  <Row gutter={8}>
                    <Col span={12}>
                      <Text strong>Opening</Text>
                      <InputNumber
                        className="w-full mt-1"
                        value={shift2Data.vehicleOpeningRPM}
                        onChange={(value) => updateShiftData(2, 'vehicleOpeningRPM', value)}
                        min={0}
                        step={0.1}
                        precision={1}
                        controls={false}
                      />
                    </Col>
                    <Col span={12}>
                      <Text strong>Closing</Text>
                      <InputNumber
                        className="w-full mt-1"
                        value={shift2Data.vehicleClosingRPM}
                        onChange={(value) => updateShiftData(2, 'vehicleClosingRPM', value)}
                        min={0}
                        step={0.1}
                        precision={1}
                        controls={false}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card title="Compressor RPM" size="small">
                  <Row gutter={8}>
                    <Col span={12}>
                      <Text strong>Opening</Text>
                      <InputNumber
                        className="w-full mt-1"
                        value={shift2Data.compressorOpeningRPM}
                        onChange={(value) => updateShiftData(2, 'compressorOpeningRPM', value)}
                        min={0}
                        step={0.1}
                        precision={1}
                        controls={false}
                      />
                    </Col>
                    <Col span={12}>
                      <Text strong>Closing</Text>
                      <InputNumber
                        className="w-full mt-1"
                        value={shift2Data.compressorClosingRPM}
                        onChange={(value) => updateShiftData(2, 'compressorClosingRPM', value)}
                        min={0}
                        step={0.1}
                        precision={1}
                        controls={false}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col xs={24} sm={6}>
                <Text strong>HSD (Machine)</Text>
                <InputNumber
                  className="w-full mt-1"
                  value={shift2Data.vehicleHSD}
                  onChange={(value) => updateShiftData(2, 'vehicleHSD', value)}
                  min={0}
                  step={0.1}
                  precision={2}
                  controls={false}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Text strong>HSD (Compressor)</Text>
                <InputNumber
                  className="w-full mt-1"
                  value={shift2Data.compressorHSD}
                  onChange={(value) => updateShiftData(2, 'compressorHSD', value)}
                  min={0}
                  step={0.1}
                  precision={2}
                  controls={false}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Text strong>Meter</Text>
                <InputNumber
                  className="w-full mt-1"
                  value={shift2Data.meter}
                  onChange={(value) => updateShiftData(2, 'meter', value)}
                  min={0}
                  step={0.1}
                  precision={2}
                  controls={false}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Text strong>No. of Holes</Text>
                <InputNumber
                  className="w-full mt-1"
                  value={shift2Data.noOfHoles}
                  onChange={(value) => updateShiftData(2, 'noOfHoles', value)}
                  min={0}
                  step={1}
                  controls={false}
                />
              </Col>
            </Row>

            {/* Employees Section */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>Employees</Text>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => addEmployeeToShift(2)}
                >
                  Add Employee
                </Button>
              </div>
              {shift2Data.employees.map((emp) => (
                <Row gutter={16} key={emp.id} style={{ marginBottom: 8 }}>
                  <Col xs={24} sm={8}>
                    <Select
                      placeholder="Select role"
                      value={emp.role}
                      onChange={(value) => updateEmployeeInShift(2, emp.id, 'role', value)}
                      className="w-full"
                      size="small"
                    >
                      <Select.Option value="operator">Operator</Select.Option>
                      <Select.Option value="helper">Helper</Select.Option>
                    </Select>
                  </Col>
                  <Col xs={24} sm={14}>
                    <Select
                      placeholder={`Select ${emp.role}`}
                      value={emp.employeeId}
                      onChange={(value) => updateEmployeeInShift(2, emp.id, 'employeeId', value)}
                      showSearch
                      optionFilterProp="children"
                      className="w-full"
                      size="small"
                    >
                      {employees.map(employee => (
                        <Select.Option key={employee.id} value={employee.id}>
                          {employee.name} ({employee.empId}){employee.designation ? ` - ${employee.designation}` : ''}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col xs={24} sm={2}>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeEmployeeFromShift(2, emp.id)}
                    />
                  </Col>
                </Row>
              ))}
            </div>
          </Card>
        )}

        <Divider />

        <div className="flex justify-end space-x-2">
          <Button type="primary" onClick={handleSubmit} loading={submitting}>
            Save Changes
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditDailyEntry;

