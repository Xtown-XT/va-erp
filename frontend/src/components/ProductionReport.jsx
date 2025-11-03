import { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  DatePicker,
  Button,
  Select,
  Typography,
  Space,
  Divider,
  message,
  Checkbox,
} from "antd";
import {
  FilePdfOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import api from "../service/api";
import { truncateToFixed } from "../utils/textUtils";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const ProductionReport = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [productionData, setProductionData] = useState([]);
  const [totals, setTotals] = useState({});
  const [sites, setSites] = useState([]);
  const [machines, setMachines] = useState([]);
  const [compressors, setCompressors] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedSiteName, setSelectedSiteName] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [selectedMachineName, setSelectedMachineName] = useState('');
  const [selectedShiftOne, setSelectedShiftOne] = useState(false);
  const [selectedShiftTwo, setSelectedShiftTwo] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');

  // Fetch production data
  const fetchProductionData = async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      let url = `/api/dailyEntries?startDate=${startDate}&endDate=${endDate}&limit=10000`;
      if (selectedSite) {
        url += `&siteId=${selectedSite}`;
      }
      if (selectedMachine) {
        url += `&vehicleId=${selectedMachine}`;
      }

      const res = await api.get(url);
      let entries = res.data.data || [];

      // Fetch services for the date range to match with entries
      
      // Collect unique vehicle and compressor IDs from entries
      const vehicleIds = [...new Set(entries.map(e => e.vehicleId).filter(Boolean))];
      const compressorIds = [...new Set(entries.map(e => e.compressorId).filter(Boolean))];
      
      // Fetch services - need to fetch by vehicleId and compressorId separately
      // or fetch all and filter client-side
      let allServices = [];
      
      try {
        // Fetch services for vehicles
        for (const vehicleId of vehicleIds) {
          try {
            const vehicleServicesRes = await api.get(`/api/services?vehicleId=${vehicleId}&limit=1000`);
            const vehicleServices = vehicleServicesRes.data.data || [];
            allServices = [...allServices, ...vehicleServices];
          } catch (err) {
            console.warn(`Could not fetch services for vehicle ${vehicleId}:`, err);
          }
        }
        
        // Fetch services for compressors
        for (const compressorId of compressorIds) {
          try {
            const compressorServicesRes = await api.get(`/api/services?compressorId=${compressorId}&limit=1000`);
            const compressorServices = compressorServicesRes.data.data || [];
            allServices = [...allServices, ...compressorServices];
          } catch (err) {
            console.warn(`Could not fetch services for compressor ${compressorId}:`, err);
          }
        }
        
        // Filter services by date range
        allServices = allServices.filter(service => {
          if (!service.serviceDate) return false;
          const serviceDate = dayjs(service.serviceDate).format('YYYY-MM-DD');
          return serviceDate >= startDate && serviceDate <= endDate;
        });
        
        // Match services to entries by date, vehicleId, and compressorId
        entries = entries.map(entry => {
          const entryDate = entry.date;
          const matchedServices = allServices.filter(service => {
            const serviceDate = service.serviceDate ? dayjs(service.serviceDate).format('YYYY-MM-DD') : null;
            
            // Match if service date matches entry date AND
            // (vehicleId matches OR compressorId matches)
            if (serviceDate === entryDate) {
              const vehicleMatch = service.vehicleId && entry.vehicleId && service.vehicleId === entry.vehicleId;
              const compressorMatch = service.compressorId && entry.compressorId && service.compressorId === entry.compressorId;
              return vehicleMatch || compressorMatch;
            }
            return false;
          });
          
          return {
            ...entry,
            services: matchedServices // Add services array to each entry
          };
        });
      } catch (servicesErr) {
        console.warn("Could not fetch services:", servicesErr);
        // Continue without services if API call fails
        entries = entries.map(entry => ({ ...entry, services: [] }));
      }

      // Apply frontend filtering based on shift and role
      if (selectedShiftOne || selectedShiftTwo || selectedRole) {
        entries = entries.filter(entry => {
          const employees = entry.employees || [];
          
          // Check shift filters
          let matchesShift = true;
          if (selectedShiftOne || selectedShiftTwo) {
            if (selectedShiftOne && selectedShiftTwo) {
              // Both shifts selected: entry must have employees from at least one of the shifts
              matchesShift = employees.some(emp => emp.shift === 1 || emp.shift === 2);
            } else if (selectedShiftOne) {
              // Only Shift One selected
              matchesShift = employees.some(emp => emp.shift === 1);
            } else if (selectedShiftTwo) {
              // Only Shift Two selected
              matchesShift = employees.some(emp => emp.shift === 2);
            }
          }
          
          // Check role filter
          let matchesRole = true;
          if (selectedRole) {
            matchesRole = employees.some(emp => emp.role === selectedRole);
          }
          
          // Both filters must match (AND logic)
          return matchesShift && matchesRole;
        });
      }

      // Calculate production metrics
      const calculations = calculateProductionMetrics(entries);
      setProductionData(calculations.dailyData);
      setTotals(calculations.totals);
    } catch (err) {
      console.error("Error fetching production data", err);
      message.error("Error fetching production data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate production metrics
  const calculateProductionMetrics = (entries) => {
    let totalCrawlerHSD = 0;
    let totalCamperHSD = 0;
    let totalCompressorHSD = 0;
    let totalTotalHSD = 0;
    let totalMeter = 0;
    let totalCrawlerRPM = 0;
    let totalCompressorRPM = 0;
    let totalHoles = 0;

    // const dailyData = entries.map(entry => {
    //   // Vehicle HSD should come from vehicleHSD, not dieselUsed (which is overall)
    //   const vehicleHSD = entry.vehicleHSD || 0;
    //   const meter = entry.meter || 0;
    //   const vehicleRPM = (entry.vehicleClosingRPM || 0) - (entry.vehicleOpeningRPM || 0);
    //   const compressorRPM = (entry.compressorClosingRPM || 0) - (entry.compressorOpeningRPM || 0);
    //   const holes = entry.noOfHoles || 0;
    //   const compressorHSD = entry.compressorHSD || 0;

    //   // Find machine type
    //   // Prefer server-provided vehicle info; fallback to machines cache
    //   const machineTypeSrc = (entry.vehicle?.vehicleType) || (machines.find(m => m.id === entry.vehicleId)?.vehicleType) || '';
    //   const machineType = machineTypeSrc.toString().trim().toLowerCase();
    //   const isCrawler = machineType === 'crawler' || machineType.includes('crawler');
    //   const isCamper = machineType === 'camper' || machineType.includes('camper') || machineType.includes('truck');

    //   // Calculate HSD breakdown
    //   let crawlerHSD = 0;
    //   let camperHSD = 0;
    //   let crawlerRPM = 0;

    //   if (isCrawler) {
    //     crawlerHSD = vehicleHSD;
    //     crawlerRPM = vehicleRPM;
    //   } else if (isCamper) {
    //     camperHSD = vehicleHSD;
    //   }

    //   const totalHSD = crawlerHSD + camperHSD + compressorHSD;

    //   // Calculate ratios
    //   const hsdMtr = meter > 0 ? ((totalHSD) / meter).toFixed(2) : 0;
    //   const mtrRPM = compressorRPM > 0 ? (meter / compressorRPM).toFixed(2) : 0;
    //   const crawlerHsdPerRpm = crawlerRPM > 0 ? (crawlerHSD / crawlerRPM).toFixed(2) : 0;
    //   const compHsdPerRpm = compressorRPM > 0 ? (compressorHSD / compressorRPM).toFixed(2) : 0;
    //   const depthAvg = holes > 0 ? (meter / holes).toFixed(2) : 0;

    //   // Add to totals
    //   totalCrawlerHSD += crawlerHSD;
    //   totalCamperHSD += camperHSD;
    //   totalCompressorHSD += compressorHSD;
    //   totalTotalHSD += totalHSD;
    //   totalMeter += meter;
    //   totalCrawlerRPM += crawlerRPM;
    //   totalCompressorRPM += compressorRPM;
    //   totalHoles += holes;

    //   return {
    //     ...entry,
    //     isCrawler,
    //     isCamper,
    //     crawlerHSD,
    //     camperHSD,
    //     compressorHSD,
    //     totalHSD,
    //     crawlerRPM,
    //     compressorRPM,
    //     hsdMtr,
    //     mtrRPM,
    //     crawlerHsdPerRpm,
    //     compHsdPerRpm,
    //     depthAvg,
    //     // Display-only values: blank when not applicable
    //     crawlerHSDDisplay: isCrawler ? (crawlerHSD || 0) : '',
    //     camperHSDDisplay: isCamper ? (camperHSD || 0) : '',
    //     crawlerRPMDisplay: isCrawler ? (crawlerRPM || 0) : '',
    //   };
    // });

    // Calculate totals for summary


    // const totals = {
    //   totalCrawlerHSD,
    //   totalCamperHSD,
    //   totalCompressorHSD,
    //   totalTotalHSD,
    //   totalMeter,
    //   totalCrawlerRPM,
    //   totalCompressorRPM,
    //   totalHoles,
    //   totalHsdMtr: totalMeter > 0 ? (totalTotalHSD / totalMeter).toFixed(2) : 0,
    //   totalMtrRPM: totalCompressorRPM > 0 ? (totalMeter / totalCompressorRPM).toFixed(2) : 0,
    //   totalCrawlerHsdPerRpm: totalCrawlerRPM > 0 ? (totalCrawlerHSD / totalCrawlerRPM).toFixed(2) : 0,
    //   totalCompHsdPerRpm: totalCompressorRPM > 0 ? (totalCompressorHSD / totalCompressorRPM).toFixed(2) : 0,
    //   totalDepthAvg: totalHoles > 0 ? (totalMeter / totalHoles).toFixed(2) : 0,
    // };



    const dailyData = entries.map(entry => {

      const vehicleHSD = parseFloat(entry.vehicleHSD) || 0;
      const meter = parseFloat(entry.meter) || 0;
      const vehicleRPM = (parseFloat(entry.vehicleClosingRPM) || 0) - (parseFloat(entry.vehicleOpeningRPM) || 0);
      const compressorRPM = (parseFloat(entry.compressorClosingRPM) || 0) - (parseFloat(entry.compressorOpeningRPM) || 0);
      const holes = parseFloat(entry.noOfHoles) || 0;
      const compressorHSD = parseFloat(entry.compressorHSD) || 0;


      const machineTypeSrc = (entry.vehicle?.vehicleType) || (machines.find(m => m.id === entry.vehicleId)?.vehicleType) || '';
      const machineType = machineTypeSrc.toString().trim().toLowerCase();
      const isCrawler = machineType === 'crawler' || machineType.includes('crawler');
      const isCamper = machineType === 'camper' || machineType.includes('camper') || machineType.includes('truck');


      let crawlerHSD = 0;
      let camperHSD = 0;
      let crawlerRPM = 0;

      if (isCrawler) {
        crawlerHSD = vehicleHSD;
        crawlerRPM = vehicleRPM;
      } else if (isCamper) {
        camperHSD = vehicleHSD;
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
        // Display-only values
        crawlerHSDDisplay: isCrawler ? crawlerHSD : '',
        camperHSDDisplay: isCamper ? camperHSD : '',
        crawlerRPMDisplay: isCrawler ? crawlerRPM : '',
        // Preserve services array if it exists
        services: entry.services || [],
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

      // FIXED: Proper ratio calculations
      totalHsdMtr: totalMeter > 0 ? parseFloat((totalTotalHSD / totalMeter).toFixed(2)) : 0,
      totalMtrRPM: totalCompressorRPM > 0 ? parseFloat((totalMeter / totalCompressorRPM).toFixed(2)) : 0,
      totalCrawlerHsdPerRpm: totalCrawlerRPM > 0 ? parseFloat((totalCrawlerHSD / totalCrawlerRPM).toFixed(2)) : 0,
      totalCompHsdPerRpm: totalCompressorRPM > 0 ? parseFloat((totalCompressorHSD / totalCompressorRPM).toFixed(2)) : 0,
      totalDepthAvg: totalHoles > 0 ? parseFloat((totalMeter / totalHoles).toFixed(2)) : 0,
    };

    return { dailyData, totals };
  };

  // (removed duplicate fetchVehicles and invalid selectedVehicle dependency)

  // Table columns
  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Meter",
      dataIndex: "meter",
      key: "meter",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "Crawler HSD",
      dataIndex: "crawlerHSDDisplay",
      key: "crawlerHSD",
      render: (value, record) => record.isCrawler ? Number(value || 0).toFixed(2) : '',
    },
    {
      title: "Compressor HSD",
      dataIndex: "compressorHSD",
      key: "compressorHSD",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "Camper HSD",
      dataIndex: "camperHSDDisplay",
      key: "camperHSD",
      render: (value, record) => record.isCamper ? Number(value || 0).toFixed(2) : '',
    },
    {
      title: "Total HSD",
      dataIndex: "totalHSD",
      key: "totalHSD",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "Crawler RPM",
      dataIndex: "crawlerRPMDisplay",
      key: "crawlerRPM",
      render: (value, record) => record.isCrawler ? Number(value || 0).toFixed(2) : '',
    },
    {
      title: "Compressor RPM",
      dataIndex: "compressorRPM",
      key: "compressorRPM",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "HSD/MTR",
      dataIndex: "hsdMtr",
      key: "hsdMtr",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "MTR/RPM",
      dataIndex: "mtrRPM",
      key: "mtrRPM",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "Crawler HSD/Crawler RPM",
      dataIndex: "crawlerHsdPerRpm",
      key: "crawlerHsdPerRpm",
      render: (value) => value > 0 ? truncateToFixed(value, 2) : '-',
    },
    {
      title: "Comp HSD/Comp RPM",
      dataIndex: "compHsdPerRpm",
      key: "compHsdPerRpm",
      render: (value) => value > 0 ? truncateToFixed(value, 2) : '-',
    },
    {
      title: "Number of Holes",
      dataIndex: "noOfHoles",
      key: "noOfHoles",
      render: (value) => value || 0,
    },
    {
      title: "Depth Avg",
      dataIndex: "depthAvg",
      key: "depthAvg",
      render: (value) => truncateToFixed(value || 0, 2),
    },
  ];

  // Export to PDF
  const exportToPDF = async () => {
    setLoading(true);
    
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      let url = `/api/dailyEntries?startDate=${startDate}&endDate=${endDate}&limit=10000`;
      if (selectedSite) url += `&siteId=${selectedSite}`;
      if (selectedMachine) url += `&vehicleId=${selectedMachine}`;

      const res = await api.get(url);
      let entries = res.data.data || [];
      
      // Fetch machines and compressors for PDF (if not already available)
      let pdfMachines = machines;
      let pdfCompressors = compressors;
      
      if (machines.length === 0) {
        try {
          const machinesRes = await api.get('/api/vehicles?limit=1000');
          pdfMachines = machinesRes.data.data || [];
        } catch (err) {
          console.warn('Could not fetch machines for PDF:', err);
        }
      }
      
      if (compressors.length === 0) {
        try {
          const compressorsRes = await api.get('/api/compressors?limit=1000');
          pdfCompressors = compressorsRes.data.data || [];
        } catch (err) {
          console.warn('Could not fetch compressors for PDF:', err);
        }
      }

      // Fetch services for PDF export
      const pdfVehicleIds = [...new Set(entries.map(e => e.vehicleId).filter(Boolean))];
      const pdfCompressorIds = [...new Set(entries.map(e => e.compressorId).filter(Boolean))];
      
      let pdfAllServices = [];
      
      try {
        // Fetch services for vehicles
        for (const vehicleId of pdfVehicleIds) {
          try {
            const vehicleServicesRes = await api.get(`/api/services?vehicleId=${vehicleId}&limit=1000`);
            const vehicleServices = vehicleServicesRes.data.data || [];
            pdfAllServices = [...pdfAllServices, ...vehicleServices];
          } catch (err) {
            console.warn(`Could not fetch services for vehicle ${vehicleId}:`, err);
          }
        }
        
        // Fetch services for compressors
        for (const compressorId of pdfCompressorIds) {
          try {
            const compressorServicesRes = await api.get(`/api/services?compressorId=${compressorId}&limit=1000`);
            const compressorServices = compressorServicesRes.data.data || [];
            pdfAllServices = [...pdfAllServices, ...compressorServices];
          } catch (err) {
            console.warn(`Could not fetch services for compressor ${compressorId}:`, err);
          }
        }
        
        // Filter services by date range
        pdfAllServices = pdfAllServices.filter(service => {
          if (!service.serviceDate) return false;
          const serviceDate = dayjs(service.serviceDate).format('YYYY-MM-DD');
          return serviceDate >= startDate && serviceDate <= endDate;
        });
        
        // Match services to entries
        entries = entries.map(entry => {
          const entryDate = entry.date ? dayjs(entry.date).format('YYYY-MM-DD') : null;
          const matchedServices = pdfAllServices.filter(service => {
            const serviceDate = service.serviceDate ? dayjs(service.serviceDate).format('YYYY-MM-DD') : null;
            
            if (serviceDate === entryDate) {
              const vehicleMatch = service.vehicleId && entry.vehicleId && service.vehicleId === entry.vehicleId;
              const compressorMatch = service.compressorId && entry.compressorId && service.compressorId === entry.compressorId;
              return vehicleMatch || compressorMatch;
            }
            return false;
          });
          
          return {
            ...entry,
            services: matchedServices
          };
        });
      } catch (servicesErr) {
        console.warn("Could not fetch services for PDF:", servicesErr);
        entries = entries.map(entry => ({ ...entry, services: [] }));
      }

      // Apply frontend filtering based on shift and role (same as in fetchProductionData)
      if (selectedShiftOne || selectedShiftTwo || selectedRole) {
        entries = entries.filter(entry => {
          const employees = entry.employees || [];
          
          // Check shift filters
          let matchesShift = true;
          if (selectedShiftOne || selectedShiftTwo) {
            if (selectedShiftOne && selectedShiftTwo) {
              // Both shifts selected: entry must have employees from at least one of the shifts
              matchesShift = employees.some(emp => emp.shift === 1 || emp.shift === 2);
            } else if (selectedShiftOne) {
              // Only Shift One selected
              matchesShift = employees.some(emp => emp.shift === 1);
            } else if (selectedShiftTwo) {
              // Only Shift Two selected
              matchesShift = employees.some(emp => emp.shift === 2);
            }
          }
          
          // Check role filter
          let matchesRole = true;
          if (selectedRole) {
            matchesRole = employees.some(emp => emp.role === selectedRole);
          }
          
          // Both filters must match (AND logic)
          return matchesShift && matchesRole;
        });
      }

    const { dailyData, totals } = calculateProductionMetrics(entries);

    // Calculate Employee Summary for PDF (only if filters are selected)
    let employeeSummaryHTML = '';
    if (selectedShiftOne || selectedShiftTwo || selectedRole) {
      // Collect all unique employees from all filtered entries
      const allEmployees = new Map();
      
      entries.forEach(entry => {
        const employees = entry.employees || [];
        employees.forEach(emp => {
          const key = `${emp.id || emp.employeeId || ''}_${emp.shift}_${emp.role}`;
          if (!allEmployees.has(key)) {
            allEmployees.set(key, {
              id: emp.id || emp.employeeId,
              name: emp.name || 'Unknown',
              empId: emp.empId || '',
              role: emp.role || 'operator',
              shift: emp.shift || 1
            });
          }
        });
      });
      
      const employeesArray = Array.from(allEmployees.values());
      
      // Filter employees based on selected filters
      let shiftOneEmployees = [];
      let shiftTwoEmployees = [];
      let operatorEmployees = [];
      let helperEmployees = [];
      
      // Only show employees from checked shifts
      if (selectedShiftOne || selectedShiftTwo) {
        // If ONLY Shift One is checked
        if (selectedShiftOne && !selectedShiftTwo) {
          shiftOneEmployees = employeesArray.filter(emp => emp.shift === 1);
          shiftTwoEmployees = []; // Empty - not selected
          operatorEmployees = employeesArray.filter(emp => emp.role === 'operator' && emp.shift === 1);
          helperEmployees = employeesArray.filter(emp => emp.role === 'helper' && emp.shift === 1);
        }
        // If ONLY Shift Two is checked
        else if (selectedShiftTwo && !selectedShiftOne) {
          shiftOneEmployees = []; // Empty - not selected
          shiftTwoEmployees = employeesArray.filter(emp => emp.shift === 2);
          operatorEmployees = employeesArray.filter(emp => emp.role === 'operator' && emp.shift === 2);
          helperEmployees = employeesArray.filter(emp => emp.role === 'helper' && emp.shift === 2);
        }
        // If BOTH shifts are checked
        else if (selectedShiftOne && selectedShiftTwo) {
          shiftOneEmployees = employeesArray.filter(emp => emp.shift === 1);
          shiftTwoEmployees = employeesArray.filter(emp => emp.shift === 2);
          operatorEmployees = employeesArray.filter(emp => emp.role === 'operator');
          helperEmployees = employeesArray.filter(emp => emp.role === 'helper');
        }
        
        // Apply role filter if selected (further filter the above results)
        if (selectedRole) {
          shiftOneEmployees = shiftOneEmployees.filter(emp => emp.role === selectedRole);
          shiftTwoEmployees = shiftTwoEmployees.filter(emp => emp.role === selectedRole);
        }
      } else {
        // No shift filters - show all employees
        shiftOneEmployees = employeesArray.filter(emp => emp.shift === 1);
        shiftTwoEmployees = employeesArray.filter(emp => emp.shift === 2);
        operatorEmployees = employeesArray.filter(emp => emp.role === 'operator');
        helperEmployees = employeesArray.filter(emp => emp.role === 'helper');
        
        // Apply role filter if selected
        if (selectedRole) {
          shiftOneEmployees = shiftOneEmployees.filter(emp => emp.role === selectedRole);
          shiftTwoEmployees = shiftTwoEmployees.filter(emp => emp.role === selectedRole);
          operatorEmployees = operatorEmployees.filter(emp => emp.role === selectedRole);
          helperEmployees = helperEmployees.filter(emp => emp.role === selectedRole);
        }
      }
          
          // Format employee names with IDs
          const formatEmployees = (empList) => {
            return empList.length > 0 
              ? empList.map(emp => emp.empId ? `${emp.name} (${emp.empId})` : emp.name).join(', ')
              : 'None';
          };
      
      employeeSummaryHTML = `
        <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
          <h3 style="margin-top: 0;">Employee Summary</h3>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
            <div>
              <strong>Shift One:</strong><br/>
              <span>${formatEmployees(shiftOneEmployees)}</span>
            </div>
            <div>
              <strong>Shift Two:</strong><br/>
              <span>${formatEmployees(shiftTwoEmployees)}</span>
            </div>
            <div>
              <strong>Operator:</strong><br/>
              <span>${formatEmployees(operatorEmployees)}</span>
            </div>
            <div>
              <strong>Helper:</strong><br/>
              <span>${formatEmployees(helperEmployees)}</span>
            </div>
          </div>
        </div>
      `;
    }

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Daily Production Report${selectedSiteName ? ` - ${selectedSiteName}` : ''}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; position: relative; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0; }
            .generated-on { position: absolute; top: 0; right: 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
            th { background-color: #f2f2f2; }
            .total-row { background-color: #f9f9f9; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Daily Production Report</h1>
            <p>Period: ${dateRange[0].format("DD/MM/YYYY")} to ${dateRange[1].format("DD/MM/YYYY")}</p>
            <p>Site: ${selectedSiteName || 'All Sites'}</p>
            <p class="generated-on">Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          ${employeeSummaryHTML}
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Meter</th>
                <th>Crawler HSD</th>
                <th>Compressor HSD</th>
                <th>Camper HSD</th>
                <th>Total HSD</th>
                <th>Crawler RPM</th>
                <th>Compressor RPM</th>
                <th>HSD/MTR</th>
                <th>MTR/RPM</th>
                <th>Crawler HSD/Crawler RPM</th>
                <th>Comp HSD/Comp RPM</th>
                <th>Number of Holes</th>
                <th>Depth Avg</th>
              </tr>
            </thead>
            <tbody>
              ${dailyData.map((entry, entryIndex) => {
                const services = entry.services || [];
                const servicesText = services.length > 0 
                  ? services.map((service, idx) => {
                      const serviceTypeLabel = service.serviceType === 'vehicle' ? 'Vehicle' : 
                                             service.serviceType === 'compressor' ? 'Compressor' : 'Item';
                      const serviceName = service.serviceName || 'Unnamed Service';
                      return `${serviceTypeLabel}: ${serviceName}`;
                    }).join(', ')
                  : 'None';
                
                return `
                <tr>
                  <td>${dayjs(entry.date).format("DD/MM/YYYY")}</td>
                  <td>${truncateToFixed(entry.meter || 0, 2)}</td>
                  <td>${truncateToFixed(entry.crawlerHSD || 0, 2)}</td>
                  <td>${truncateToFixed(entry.compressorHSD || 0, 2)}</td>
                  <td>${truncateToFixed(entry.camperHSD || 0, 2)}</td>
                  <td>${truncateToFixed(entry.totalHSD || 0, 2)}</td>
                  <td>${truncateToFixed(entry.crawlerRPM || 0, 2)}</td>
                  <td>${truncateToFixed(entry.compressorRPM || 0, 2)}</td>
                  <td>${truncateToFixed(entry.hsdMtr || 0, 2)}</td>
                  <td>${truncateToFixed(entry.mtrRPM || 0, 2)}</td>
                  <td>${entry.crawlerHsdPerRpm > 0 ? truncateToFixed(entry.crawlerHsdPerRpm, 2) : '-'}</td>
                  <td>${entry.compHsdPerRpm > 0 ? truncateToFixed(entry.compHsdPerRpm, 2) : '-'}</td>
                  <td>${entry.noOfHoles || 0}</td>
                  <td>${truncateToFixed(entry.depthAvg || 0, 2)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td>Total</td>
                <td>${truncateToFixed(totals.totalMeter || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalCrawlerHSD || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalCompressorHSD || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalCamperHSD || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalTotalHSD || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalCrawlerRPM || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalCompressorRPM || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalHsdMtr || 0, 2)}</td>
                <td>${truncateToFixed(totals.totalMtrRPM || 0, 2)}</td>
                <td>${totals.totalCrawlerHsdPerRpm > 0 ? truncateToFixed(totals.totalCrawlerHsdPerRpm, 2) : '-'}</td>
                <td>${totals.totalCompHsdPerRpm > 0 ? truncateToFixed(totals.totalCompHsdPerRpm, 2) : '-'}</td>
                <td>${totals.totalHoles || 0}</td>
                <td>${truncateToFixed(totals.totalDepthAvg || 0, 2)}</td>
              </tr>
            </tfoot>
          </table>
          
          ${(() => {
            const entriesWithServices = dailyData.filter(entry => entry.services && entry.services.length > 0);
            if (entriesWithServices.length === 0) return '';
            
            // Group entries by date for better organization
            const entriesByDate = {};
            entriesWithServices.forEach(entry => {
              const dateKey = dayjs(entry.date).format("DD/MM/YYYY");
              if (!entriesByDate[dateKey]) {
                entriesByDate[dateKey] = [];
              }
              entriesByDate[dateKey].push(entry);
            });
            
            return `
            <div style="margin-top: 40px;">
              <h2 style="text-align: center; margin-bottom: 20px;">Maintenance</h2>
              ${Object.keys(entriesByDate).map(dateKey => {
                const dateEntries = entriesByDate[dateKey];
                return dateEntries.map((entry, entryIdx) => {
                  const machine = entry.vehicle || (pdfMachines && pdfMachines.find(m => m.id === entry.vehicleId));
                  const compressor = pdfCompressors && pdfCompressors.find(c => c.id === entry.compressorId);
                  const machineName = machine ? `${machine.vehicleType || 'Machine'} ${machine.vehicleNumber || ''}`.trim() : '-';
                  const compressorName = compressor?.compressorName || '-';
                  
                  // Separate vehicle and compressor services
                  const vehicleServices = entry.services.filter(s => s.serviceType === 'vehicle');
                  const compressorServices = entry.services.filter(s => s.serviceType === 'compressor');
                  const itemServices = entry.services.filter(s => s.serviceType === 'item');
                  
                  let maintenanceHTML = '';
                  
                  // Vehicle services (HITACHI ENG SERVICE)
                  if (vehicleServices.length > 0) {
                    vehicleServices.forEach(service => {
                      const serviceName = service.serviceName || 'Service';
                      const serviceRPM = truncateToFixed(service.serviceRPM || 0, 2);
                      const nextServiceRPM = service.nextServiceRPM ? truncateToFixed(service.nextServiceRPM, 2) : null;
                      const serviceInterval = nextServiceRPM && serviceRPM ? truncateToFixed(nextServiceRPM - parseFloat(serviceRPM), 2) : null;
                      
                      let serviceText = `<strong>${machineName} ENG SERVICE:</strong> ${serviceName} RPM- ${serviceRPM}`;
                      if (serviceInterval && nextServiceRPM) {
                        serviceText += `+${serviceInterval} = ${nextServiceRPM}`;
                      } else if (nextServiceRPM) {
                        serviceText += ` (Next: ${nextServiceRPM})`;
                      }
                      maintenanceHTML += `<div style="margin: 8px 0; padding-left: 20px;">${serviceText}</div>`;
                    });
                  }
                  
                  // Compressor services (COMPRESSER ENG SERVICE)
                  if (compressorServices.length > 0) {
                    compressorServices.forEach(service => {
                      const serviceName = service.serviceName || 'Service';
                      const serviceRPM = truncateToFixed(service.serviceRPM || 0, 2);
                      const nextServiceRPM = service.nextServiceRPM ? truncateToFixed(service.nextServiceRPM, 2) : null;
                      const serviceInterval = nextServiceRPM && serviceRPM ? truncateToFixed(nextServiceRPM - parseFloat(serviceRPM), 2) : null;
                      
                      let serviceText = `<strong>COMPRESSER ENG SERVICE:</strong> ${serviceName} RPM- ${serviceRPM}`;
                      if (serviceInterval && nextServiceRPM) {
                        serviceText += `+${serviceInterval} = ${nextServiceRPM}`;
                      } else if (nextServiceRPM) {
                        serviceText += ` (Next: ${nextServiceRPM})`;
                      }
                      maintenanceHTML += `<div style="margin: 8px 0; padding-left: 20px;">${serviceText}</div>`;
                    });
                  }
                  
                  // Item services
                  if (itemServices.length > 0) {
                    itemServices.forEach(service => {
                      const serviceName = service.serviceName || 'Service';
                      const serviceRPM = truncateToFixed(service.serviceRPM || 0, 2);
                      const nextServiceRPM = service.nextServiceRPM ? truncateToFixed(service.nextServiceRPM, 2) : null;
                      const serviceInterval = nextServiceRPM && serviceRPM ? truncateToFixed(nextServiceRPM - parseFloat(serviceRPM), 2) : null;
                      
                      let serviceText = `<strong>ITEM SERVICE:</strong> ${serviceName} RPM- ${serviceRPM}`;
                      if (serviceInterval && nextServiceRPM) {
                        serviceText += `+${serviceInterval} = ${nextServiceRPM}`;
                      } else if (nextServiceRPM) {
                        serviceText += ` (Next: ${nextServiceRPM})`;
                      }
                      maintenanceHTML += `<div style="margin: 8px 0; padding-left: 20px;">${serviceText}</div>`;
                    });
                  }
                  
                  if (!maintenanceHTML) return '';
                  
                  return `
                    <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; background-color: #f9f9f9;">
                      <div style="margin-bottom: 10px;">
                        <strong>Date:</strong> ${dateKey} | 
                        <strong>Machine:</strong> ${machineName} | 
                        <strong>Compressor:</strong> ${compressorName || '-'}
                      </div>
                      ${maintenanceHTML}
                    </div>
                  `;
                }).join('');
              }).join('')}
            </div>
            `;
          })()}
        </body>
      </html>
    `);
      printWindow.document.close();
      printWindow.print();
    } catch (err) {
      console.error("Error exporting to PDF", err);
      message.error("Error exporting to PDF");
    } finally {
      setLoading(false);
    }
  };

  // Fetch sites and vehicles
  const fetchSites = async () => {
    try {
      const res = await api.get('/api/sites?limit=1000');
      setSites(res.data.data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };
  const fetchMachines = async () => {
    try {
      const res = await api.get('/api/vehicles?limit=1000');
      setMachines(res.data.data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const fetchCompressors = async () => {
    try {
      const res = await api.get('/api/compressors?limit=1000');
      setCompressors(res.data.data || []);
    } catch (error) {
      console.error('Error fetching compressors:', error);
    }
  };

  // Fetch refs on component mount
  useEffect(() => {
    fetchSites();
    fetchMachines();
    fetchCompressors();
  }, []);

  // Fetch production data when filters change
  useEffect(() => {
    fetchProductionData();
  }, [dateRange, selectedSite, selectedMachine, selectedShiftOne, selectedShiftTwo, selectedRole]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Title level={2} className="mb-2">
            Daily Production Report
            {selectedSiteName && ` - ${selectedSiteName}`}
          </Title>
          <Text type="secondary">
            {dateRange[0].format('DD/MM/YYYY')} to {dateRange[1].format('DD/MM/YYYY')}
            {selectedSiteName && ` | Site: ${selectedSiteName}`}
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchProductionData}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            icon={<FilePdfOutlined />}
            onClick={exportToPDF}
            type="primary"
            danger
          >
            Export PDF
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <Card>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8}>
            <Text strong>Date Range:</Text>
            <DatePicker.RangePicker
              className="w-full mt-1"
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col xs={24} sm={8}>
            <Text strong>Filter by Site:</Text>
            <Select
              className="w-full mt-1"
              placeholder="All sites"
              value={selectedSite}
              onChange={(value) => {
                setSelectedSite(value);
                const site = sites.find(s => s.id === value);
                setSelectedSiteName(site ? site.siteName : '');
              }}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {sites.map(site => (
                <Select.Option key={site.id} value={site.id}>
                  {site.siteName}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Text strong>Filter by Machine:</Text>
            <Select
              className="w-full mt-1"
              placeholder="All machines"
              value={selectedMachine}
              onChange={(value) => {
                setSelectedMachine(value);
                const machine = machines.find(m => m.id === value);
                setSelectedMachineName(machine ? `${machine.vehicleNumber} (${machine.vehicleType})` : '');
              }}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {machines.map(machine => (
                <Select.Option key={machine.id} value={machine.id}>
                  {machine.vehicleNumber} ({machine.vehicleType})
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Text strong>Filter by Shift:</Text>
            <div className="mt-1">
              <Checkbox
                checked={selectedShiftOne}
                onChange={(e) => setSelectedShiftOne(e.target.checked)}
              >
                Shift One
              </Checkbox>
              <Checkbox
                checked={selectedShiftTwo}
                onChange={(e) => setSelectedShiftTwo(e.target.checked)}
                style={{ marginLeft: '16px' }}
              >
                Shift Two
              </Checkbox>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <Text strong>Filter by Role:</Text>
            <Select
              className="w-full mt-1"
              placeholder="All roles"
              value={selectedRole}
              onChange={(value) => setSelectedRole(value || '')}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              <Select.Option value="operator">Operator</Select.Option>
              <Select.Option value="helper">Helper</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Button
              onClick={() => {
                setDateRange([dayjs().subtract(30, 'days'), dayjs()]);
                setSelectedSite('');
                setSelectedSiteName('');
                setSelectedMachine('');
                setSelectedMachineName('');
                setSelectedShiftOne(false);
                setSelectedShiftTwo(false);
                setSelectedRole('');
              }}
              style={{ marginTop: '24px' }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </Card>


      {/* Employee Summary Section - Only show when filters are applied */}
      {(selectedShiftOne || selectedShiftTwo || selectedRole) && (
        <Card>
          <Title level={4}>Employee Summary</Title>
          {(() => {
          // Collect all unique employees from all filtered entries
          const allEmployees = new Map();
          
          productionData.forEach(entry => {
            const employees = entry.employees || [];
            employees.forEach(emp => {
              const key = `${emp.id || emp.employeeId || ''}_${emp.shift}_${emp.role}`;
              if (!allEmployees.has(key)) {
                allEmployees.set(key, {
                  id: emp.id || emp.employeeId,
                  name: emp.name || 'Unknown',
                  empId: emp.empId || '',
                  role: emp.role || 'operator',
                  shift: emp.shift || 1
                });
              }
            });
          });
          
          const employeesArray = Array.from(allEmployees.values());
          
          // Filter employees based on selected filters
          let shiftOneEmployees = [];
          let shiftTwoEmployees = [];
          let operatorEmployees = [];
          let helperEmployees = [];
          
          // Only show employees from checked shifts
          if (selectedShiftOne || selectedShiftTwo) {
            // If ONLY Shift One is checked
            if (selectedShiftOne && !selectedShiftTwo) {
              shiftOneEmployees = employeesArray.filter(emp => emp.shift === 1);
              shiftTwoEmployees = []; // Empty - not selected
              operatorEmployees = employeesArray.filter(emp => emp.role === 'operator' && emp.shift === 1);
              helperEmployees = employeesArray.filter(emp => emp.role === 'helper' && emp.shift === 1);
            }
            // If ONLY Shift Two is checked
            else if (selectedShiftTwo && !selectedShiftOne) {
              shiftOneEmployees = []; // Empty - not selected
              shiftTwoEmployees = employeesArray.filter(emp => emp.shift === 2);
              operatorEmployees = employeesArray.filter(emp => emp.role === 'operator' && emp.shift === 2);
              helperEmployees = employeesArray.filter(emp => emp.role === 'helper' && emp.shift === 2);
            }
            // If BOTH shifts are checked
            else if (selectedShiftOne && selectedShiftTwo) {
              shiftOneEmployees = employeesArray.filter(emp => emp.shift === 1);
              shiftTwoEmployees = employeesArray.filter(emp => emp.shift === 2);
              operatorEmployees = employeesArray.filter(emp => emp.role === 'operator');
              helperEmployees = employeesArray.filter(emp => emp.role === 'helper');
            }
            
            // Apply role filter if selected (further filter the above results)
            if (selectedRole) {
              shiftOneEmployees = shiftOneEmployees.filter(emp => emp.role === selectedRole);
              shiftTwoEmployees = shiftTwoEmployees.filter(emp => emp.role === selectedRole);
              // operatorEmployees and helperEmployees are already filtered by role above
            }
          } else {
            // No shift filters - show all employees
            shiftOneEmployees = employeesArray.filter(emp => emp.shift === 1);
            shiftTwoEmployees = employeesArray.filter(emp => emp.shift === 2);
            operatorEmployees = employeesArray.filter(emp => emp.role === 'operator');
            helperEmployees = employeesArray.filter(emp => emp.role === 'helper');
            
            // Apply role filter if selected
            if (selectedRole) {
              shiftOneEmployees = shiftOneEmployees.filter(emp => emp.role === selectedRole);
              shiftTwoEmployees = shiftTwoEmployees.filter(emp => emp.role === selectedRole);
              operatorEmployees = operatorEmployees.filter(emp => emp.role === selectedRole);
              helperEmployees = helperEmployees.filter(emp => emp.role === selectedRole);
            }
          }
          
          return (
            <Row gutter={16}>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Shift One:</Text>
                  <div style={{ marginTop: '8px', minHeight: '20px' }}>
                    {shiftOneEmployees.length > 0 ? (
                      <Text>
                        {shiftOneEmployees.map((emp, index) => (
                          <span key={index}>
                            {emp.name}{emp.empId ? ` (${emp.empId})` : ''}
                            {index < shiftOneEmployees.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </Text>
                    ) : (
                      <Text type="secondary">None</Text>
                    )}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Shift Two:</Text>
                  <div style={{ marginTop: '8px', minHeight: '20px' }}>
                    {shiftTwoEmployees.length > 0 ? (
                      <Text>
                        {shiftTwoEmployees.map((emp, index) => (
                          <span key={index}>
                            {emp.name}{emp.empId ? ` (${emp.empId})` : ''}
                            {index < shiftTwoEmployees.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </Text>
                    ) : (
                      <Text type="secondary">None</Text>
                    )}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Operator:</Text>
                  <div style={{ marginTop: '8px', minHeight: '20px' }}>
                    {operatorEmployees.length > 0 ? (
                      <Text>
                        {operatorEmployees.map((emp, index) => (
                          <span key={index}>
                            {emp.name}{emp.empId ? ` (${emp.empId})` : ''}
                            {index < operatorEmployees.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </Text>
                    ) : (
                      <Text type="secondary">None</Text>
                    )}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Helper:</Text>
                  <div style={{ marginTop: '8px', minHeight: '20px' }}>
                    {helperEmployees.length > 0 ? (
                      <Text>
                        {helperEmployees.map((emp, index) => (
                          <span key={index}>
                            {emp.name}{emp.empId ? ` (${emp.empId})` : ''}
                            {index < helperEmployees.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </Text>
                    ) : (
                      <Text type="secondary">None</Text>
                    )}
                  </div>
                </div>
              </Col>
            </Row>
          );
          })()}
        </Card>
      )}

      {/* Production Data Table */}
      <Card>
        <Title level={4}>Daily Production Data</Title>
        <Table
          columns={columns}
          dataSource={productionData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} entries`,
          }}
          scroll={{ x: 1200 }}
          size="small"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Text strong>Total</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={1}>
                  <Text strong>{truncateToFixed(totals.totalMeter || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={2}>
                  <Text strong>{truncateToFixed(totals.totalCrawlerHSD || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={3}>
                  <Text strong>{truncateToFixed(totals.totalCompressorHSD || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={4}>
                  <Text strong>{truncateToFixed(totals.totalCamperHSD || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={5}>
                  <Text strong>{truncateToFixed(totals.totalTotalHSD || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={6}>
                  <Text strong>{truncateToFixed(totals.totalCrawlerRPM || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={7}>
                  <Text strong>{truncateToFixed(totals.totalCompressorRPM || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={8}>
                  <Text strong>{truncateToFixed(totals.totalHsdMtr || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={9}>
                  <Text strong>{truncateToFixed(totals.totalMtrRPM || 0, 2)}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={10}>
                  <Text strong>{totals.totalCrawlerHsdPerRpm > 0 ? truncateToFixed(totals.totalCrawlerHsdPerRpm, 2) : '-'}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={11}>
                  <Text strong>{totals.totalCompHsdPerRpm > 0 ? truncateToFixed(totals.totalCompHsdPerRpm, 2) : '-'}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={12}>
                  <Text strong>{totals.totalHoles || 0}</Text>
                </Table.Summary.Cell>

                <Table.Summary.Cell index={13}>
                  <Text strong>{truncateToFixed(totals.totalDepthAvg || 0, 2)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>

          )}
        />
      </Card>

      {/* Services Section - Display outside table */}
      {productionData.some(entry => entry.services && entry.services.length > 0) && (
        <Card>
          <Title level={4}>Services Performed</Title>
          <Table
            dataSource={productionData.filter(entry => entry.services && entry.services.length > 0)}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: "Date",
                dataIndex: "date",
                key: "date",
                render: (date) => dayjs(date).format("DD/MM/YYYY"),
              },
              {
                title: "Machine",
                key: "machine",
                render: (_, record) => {
                  const machine = record.vehicle || machines.find(m => m.id === record.vehicleId);
                  if (!machine) return '-';
                  const name = machine.vehicleType || 'Machine';
                  const number = machine.vehicleNumber || '';
                  return number ? `${name} (${number})` : name;
                }
              },
              {
                title: "Compressor",
                key: "compressor",
                render: (_, record) => {
                  if (!record.compressorId) return '-';
                  const compressor = compressors.find(c => c.id === record.compressorId);
                  return compressor?.compressorName || '-';
                }
              },
              {
                title: "Services",
                key: "services",
                render: (_, record) => {
                  const services = record.services || [];
                  if (services.length === 0) return <Text type="secondary">None</Text>;
                  
                  return (
                    <div>
                      {services.map((service, index) => {
                        const serviceTypeLabel = service.serviceType === 'vehicle' ? 'Vehicle' : 
                                               service.serviceType === 'compressor' ? 'Compressor' : 'Item';
                        const serviceName = service.serviceName || 'Unnamed Service';
                        return (
                          <div key={index} style={{ marginBottom: '4px' }}>
                            <Text>
                              <Text strong>{serviceTypeLabel}:</Text> {serviceName}
                              {service.nextServiceRPM && (
                                <Text type="secondary" style={{ marginLeft: '12px' }}>
                                  | Next Service: {truncateToFixed(service.nextServiceRPM, 2)} RPM
                                </Text>
                              )}
                            </Text>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              },
              {
                title: "Vehicle Next Service",
                key: "vehicleNextService",
                render: (_, record) => {
                  const machine = record.vehicle || machines.find(m => m.id === record.vehicleId);
                  return machine?.nextServiceRPM ? `${truncateToFixed(machine.nextServiceRPM, 2)} RPM` : '-';
                }
              },
              {
                title: "Compressor Next Service",
                key: "compressorNextService",
                render: (_, record) => {
                  if (!record.compressorId) return '-';
                  const compressor = compressors.find(c => c.id === record.compressorId);
                  return compressor?.nextServiceRPM ? `${truncateToFixed(compressor.nextServiceRPM, 2)} RPM` : '-';
                }
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
};

export default ProductionReport;
