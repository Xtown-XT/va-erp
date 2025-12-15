import axios from 'axios';

const API_URL = 'http://localhost:5000/api/machines';
// Need auth? Usually yes. But let's try assuming local dev might be open or I can grab a token.
// Actually, I can't easily grab a token from here without logging in.
// I will use a simple specialized route or just bypass auth for a moment if possible?
// No, strict auth is on.

// Alternative: I'll use `run_command` to execute a node script that imports the model and queries DB directly.
// That is much better.

import { connectDB } from "./src/config/db.js";
import Machine from "./src/modules/machine/machine.model.js";

const debugMachines = async () => {
    try {
        await connectDB();
        const machines = await Machine.findAll();
        console.log("Found machines:", machines.length);
        machines.forEach(m => {
            console.log(`Machine: ${m.machineNumber}, Config Type: ${typeof m.maintenanceConfig}, IsArray: ${Array.isArray(m.maintenanceConfig)}`);
            console.log('Config:', JSON.stringify(m.maintenanceConfig, null, 2));
        });
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

debugMachines();
