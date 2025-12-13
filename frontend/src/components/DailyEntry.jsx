import { useState, useEffect } from "react";
import {
  Button,
  Form,
  Card,
  DatePicker,
  message,
  Row,
  Col,
  Space,
  Typography,
  Tabs,
  Input
} from "antd";
import {
  SaveOutlined
} from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";
import {
  useSites,
  useMachines,
  useCompressors,
  useEmployees,
  useDailyEntries // List Query
} from "../hooks/useQueries";
import { useCreateDailyEntry, useDeleteDailyEntry } from "../hooks/useMutations"; // Update mutation if needed for edits
import ShiftForm from "./ShiftForm";
import DrillingToolsSection from "./DrillingToolsSection";
import DailyEntryList from "./DailyEntryList";

const { Title } = Typography;

const DailyEntry = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("entry"); // 'entry' or 'list'

  // State for Aux Data
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [shift1Enabled, setShift1Enabled] = useState(true);
  const [shift2Enabled, setShift2Enabled] = useState(false);

  // Selected Assets (for Config/RPM limits)
  const [shift1Machine, setShift1Machine] = useState(null);
  const [shift2Machine, setShift2Machine] = useState(null);
  const [shift1Compressor, setShift1Compressor] = useState(null);
  const [shift2Compressor, setShift2Compressor] = useState(null);

  // Drilling Tools State
  const [drillingTools, setDrillingTools] = useState([]);

  // Queries
  const { data: sites = [] } = useSites();
  const { data: machines = [] } = useMachines();
  const { data: compressors = [] } = useCompressors();
  const { data: employees = [] } = useEmployees();

  // List Query State
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const { data: entriesData, isLoading: loadingList, refetch } = useDailyEntries({
    page: pagination.current,
    limit: pagination.pageSize,
    date: activeTab === 'list' ? undefined : selectedDate.format('YYYY-MM-DD') // Filter by date in list? Or just show all? Usually show all.
    // But user might want to see entries for a date.
    // Let's keep existing list logic: show all by default or allow filter.
    // For now, pass basic params.
  });

  // Mutations
  const createDailyEntry = useCreateDailyEntry();
  const deleteDailyEntry = useDeleteDailyEntry();

  // Reference Generation
  const [refNo1, setRefNo1] = useState("");

  const fetchRef = async () => {
    try {
      const res = await api.get("/api/dailyEntries/generate-ref");
      setRefNo1(res.data.refNo);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchRef();
  }, []); // On mount

  // Handle Machine Change
  const handleMachineChange = async (machineId, shift) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;

    // Set Machine State
    if (shift === 1) {
      setShift1Machine(machine);
    } else {
      setShift2Machine(machine);
    }

    // Auto-fill Compressor
    let compressor = null;
    if (machine.compressorId) {
      compressor = compressors.find(c => c.id === machine.compressorId);
      // Fallback fetch if not in list
      if (!compressor) {
        try {
          const res = await api.get(`/api/compressors/${machine.compressorId}`);
          compressor = res.data.data;
        } catch (e) { console.error(e); }
      }
    }

    if (shift === 1) {
      setShift1Compressor(compressor);
      // Only update form values
      form.setFieldsValue({
        shift1_siteId: machine.siteId,
        shift1_machineOpeningRPM: machine.machineRPM || 0,
        shift1_compressorId: compressor?.id,
        shift1_compressorOpeningRPM: compressor?.compressorRPM || 0
      });

      // Fetch Fitted Tools for Compressor (Only for Shift 1 logic for now)
      if (compressor) {
        fetchFittedTools(compressor.id);
      }

      // Sync to Shift 2 if enabled
      if (shift2Enabled) {
        setShift2Machine(machine);
        setShift2Compressor(compressor);
        form.setFieldsValue({
          shift2_siteId: machine.siteId,
          shift2_machineId: machine.id,
          shift2_compressorId: compressor?.id,
          shift2_compressorOpeningRPM: compressor?.compressorRPM || 0,
          // Shift 2 Machine Open/Close logic should be chained?
          // Shift 2 Open = Shift 1 Close? But Shift 1 Close isn't entered yet.
          // Leave Shift 2 Open empty or = Machine Current RPM?
          shift2_machineOpeningRPM: machine.machineRPM || 0
        });
      }
    } else {
      setShift2Compressor(compressor);
      form.setFieldsValue({
        shift2_siteId: machine.siteId,
        shift2_compressorId: compressor?.id,
        shift2_compressorOpeningRPM: compressor?.compressorRPM || 0
      });
    }
  };

  const fetchFittedTools = async (compressorId) => {
    try {
      const res = await api.get(`/api/dailyEntries/fitted-tools?compressorId=${compressorId}`);
      if (res.data.success) {
        setDrillingTools(res.data.data.map(t => ({
          id: t.id, // Use existing ID
          itemId: t.itemId,
          itemName: t.itemName,
          partNumber: t.partNumber,
          quantity: t.quantity,
          startingRPM: t.currentRPM || 0, // Last known RPM
          currentRPM: t.currentRPM || 0,
          currentMeter: t.currentMeter || 0,
          isExisting: true
        })));
      }
    } catch (e) { console.error("Error fetching fittings", e); }
  };

  // Drilling Tools Handlers
  const handleAddTool = (item, qty) => {
    setDrillingTools(prev => [
      ...prev,
      {
        id: Date.now(), // Temp ID
        itemId: item.id,
        itemName: item.itemName,
        partNumber: item.partNumber,
        quantity: qty,
        action: 'fit', // Marker for backend 'INSTALL'
        startingRPM: (shift1Compressor?.compressorRPM || 0),
        currentRPM: (shift1Compressor?.compressorRPM || 0),
        currentMeter: 0,
        isExisting: false
      }
    ]);
  };

  const handleRemoveTool = (id) => {
    setDrillingTools(prev => prev.map(t => t.id === id ? { ...t, action: 'remove' } : t));
  };

  const handleUpdateTool = (id, field, value) => {
    setDrillingTools(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // Submit
  const onFinish = async (values) => {
    try {
      const dateVal = selectedDate.format("YYYY-MM-DD");

      // Helper to prepare spares with names (optional, backend just needs IDs usually, but let's check payload)
      // Controller expects { itemId, quantity } in array.
      // ServiceEntryForm produces { itemId, quantity } objects in Form.List

      // Shift 1
      if (shift1Enabled) {
        const payload1 = {
          date: dateVal,
          shift: 1,
          siteId: values.shift1_siteId,
          machineId: values.shift1_machineId,
          compressorId: values.shift1_compressorId,

          machineOpeningRPM: values.shift1_machineOpeningRPM,
          machineClosingRPM: values.shift1_machineClosingRPM,
          compressorOpeningRPM: values.shift1_compressorOpeningRPM,
          compressorClosingRPM: values.shift1_compressorClosingRPM,

          noOfHoles: values.shift1_noOfHoles,
          meter: values.shift1_meter,
          dieselUsed: values.shift1_dieselUsed,
          machineHSD: values.shift1_machineHSD,

          machineServiceDone: values.shift1_machineServiceDone,
          machineServiceName: Array.isArray(values.shift1_machineServiceName) ? values.shift1_machineServiceName[0] : values.shift1_machineServiceName,
          machineGeneralSpares: values.shift1_machineGeneralSpares, // Array of {itemId, quantity}

          compressorServiceDone: values.shift1_compressorServiceDone,
          compressorServiceName: Array.isArray(values.shift1_compressorServiceName) ? values.shift1_compressorServiceName[0] : values.shift1_compressorServiceName,
          compressorGeneralSpares: values.shift1_compressorGeneralSpares,

          employees: values.shift1_employees, // [{employeeId, role}]

          // Maps frontend 'fit'/'remove' to backend 'INSTALL'/'REMOVE'
          drillingTools: drillingTools.map(t => ({
            toolId: t.itemId,
            action: t.action === 'fit' ? 'INSTALL' : (t.action === 'remove' ? 'REMOVE' : 'UPDATE'),
            quantity: t.quantity,
            currentMachineRPM: t.currentRPM, // Using manual input or auto?
            // User manually edits currentRPM in table.
            // Or if auto, we should calculate based on compressor usage?
            // currentRPM in DrillingToolsSection is editable.
          })).filter(t => t.action) // Only send those with actions? Or backend updates existing too?
          // Backend creates Log for each item passed. 'UPDATE' log isn't explicit but 'Keep' logic?
          // Actually existing logic `processDrillingTools` always creates a log.
          // So we should pass all relevant tools.
          // If action is undefined/null (existing unchanged), pass 'UPDATE' or 'CHECK'?
          // Let's pass 'UPDATE' for status tracking.
          // Wait, backend `DrillingToolLog` model logs actions.
          // If we pass 'UPDATE', it logs 'UPDATE'.
        };

        // RefNo
        payload1.refNo = refNo1;

        await createDailyEntry.mutateAsync(payload1);
      }

      // Shift 2
      if (shift2Enabled) {
        const payload2 = {
          date: dateVal,
          shift: 2,
          siteId: values.shift2_siteId,
          machineId: values.shift2_machineId,
          compressorId: values.shift2_compressorId,

          machineOpeningRPM: values.shift2_machineOpeningRPM,
          machineClosingRPM: values.shift2_machineClosingRPM,
          compressorOpeningRPM: values.shift2_compressorOpeningRPM,
          compressorClosingRPM: values.shift2_compressorClosingRPM,

          noOfHoles: values.shift2_noOfHoles,
          meter: values.shift2_meter,
          dieselUsed: values.shift2_dieselUsed,
          machineHSD: values.shift2_machineHSD,

          machineServiceDone: values.shift2_machineServiceDone,
          machineServiceName: Array.isArray(values.shift2_machineServiceName) ? values.shift2_machineServiceName[0] : values.shift2_machineServiceName,
          machineGeneralSpares: values.shift2_machineGeneralSpares,

          compressorServiceDone: values.shift2_compressorServiceDone,
          compressorServiceName: Array.isArray(values.shift2_compressorServiceName) ? values.shift2_compressorServiceName[0] : values.shift2_compressorServiceName,
          compressorGeneralSpares: values.shift2_compressorGeneralSpares,

          employees: values.shift2_employees,
          // Shift 2 usually doesn't log drilling tools actions separately?
          // Assuming daily entries log tools once per day or per shift?
          // Logic usually: Tools fitted on Shift 1 or Shift 2.
          // But we only have one Drilling Tools Section.
          // We send it with Shift 1.
        };
        // Auto-gen ref for shift 2 or append?
        // Backend auto-gens if missing.
        // We can let backend handle it or pass one.
        await createDailyEntry.mutateAsync(payload2);
      }

      message.success("Entries Saved!");
      form.resetFields();
      setDrillingTools([]);
      setShift1Enabled(true);
      setShift2Enabled(false);
      fetchRef();
      refetch(); // Refresh list
    } catch (err) {
      console.error(err);
      message.error("Failed to save entry");
    }
  };

  // Delete Handler
  const handleDelete = async (id) => {
    try {
      await deleteDailyEntry.mutateAsync(id);
      message.success("Deleted");
      refetch();
    } catch (e) { message.error("Failed to delete"); }
  };

  return (
    <div className="p-2">
      <Row gutter={16} className="mb-4">
        <Col>
          <Title level={4}>Daily Entries</Title>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'entry',
            label: 'New Entry',
            children: (
              <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                initialValues={{
                  shift1_employees: [],
                  shift2_employees: []
                }}
              >
                {/* Top Controls */}
                <Card className="mb-4 shadow-sm" size="small">
                  <Row gutter={16} align="middle">
                    <Col span={6}>
                      <Form.Item label="Date" className="mb-0">
                        <DatePicker value={selectedDate} onChange={setSelectedDate} className="w-full" allowClear={false} format="DD/MM/YYYY" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label="Ref No (Auto)" className="mb-0">
                        <Input value={refNo1} readOnly className="bg-gray-100" />
                      </Form.Item>
                    </Col>
                    <Col span={12} className="text-right">
                      <Space>
                        <Button onClick={() => form.resetFields()}>Clear</Button>
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Save Entries</Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                {/* Shift Forms */}
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <ShiftForm
                      shift={1}
                      form={form}
                      sites={sites}
                      machines={machines}
                      employees={employees}
                      onMachineChange={handleMachineChange}
                      isActive={shift1Enabled}
                      onToggle={() => setShift1Enabled(!shift1Enabled)}
                      machineMaintenanceConfig={shift1Machine?.maintenanceConfig}
                      compressorMaintenanceConfig={shift1Compressor?.maintenanceConfig}
                    />
                  </Col>
                  <Col xs={24} lg={12}>
                    <ShiftForm
                      shift={2}
                      form={form}
                      sites={sites}
                      machines={machines}
                      employees={employees}
                      onMachineChange={handleMachineChange}
                      isActive={shift2Enabled}
                      onToggle={() => setShift2Enabled(!shift2Enabled)}
                      machineMaintenanceConfig={shift2Machine?.maintenanceConfig}
                      compressorMaintenanceConfig={shift2Compressor?.maintenanceConfig}
                    />
                  </Col>
                </Row>

                {/* Drilling Tools - Only if Shift 1 Compressor is set */}
                {shift1Compressor && (
                  <DrillingToolsSection
                    drillingTools={drillingTools}
                    onAddTool={handleAddTool}
                    onRemoveTool={handleRemoveTool}
                    onUpdateTool={handleUpdateTool}
                    compressorName={shift1Compressor?.compressorName}
                  />
                )}

              </Form>
            )
          },
          {
            key: 'list',
            label: 'History List',
            children: (
              <Card>
                <DailyEntryList
                  entries={entriesData?.data || []}
                  loading={loadingList}
                  pagination={{
                    ...pagination,
                    total: entriesData?.total || 0,
                    onChange: (page, pageSize) => setPagination({ current: page, pageSize })
                  }}
                  onDelete={handleDelete}
                  onEdit={(record) => {
                    // TODO: Implement Edit Logic
                    // Ideally load record into form and switch tab
                    // But edit creates complexity with "Shift 1 vs 2" linking.
                    // For now, allow delete/re-create or basic edit.
                    message.info("Edit feature refactoring in progress. Please delete and re-create if needed or use backend update.");
                  }}
                />
              </Card>
            )
          }
        ]}
      />
    </div>
  );
};

export default DailyEntry;
