import sequelize from '../src/config/db.js';

async function inspect() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        try {
            const [results] = await sequelize.query('DESCRIBE employeeList;');
            console.log('Schema for employeeList:');
            console.table(results);
        } catch (e) {
            console.log('employeeList table might not exist:', e.message);
        }

        try {
            const [results] = await sequelize.query('DESCRIBE dailyEntry;');
            console.log('Schema for dailyEntry:');
            console.table(results);
        } catch (e) {
            console.log('dailyEntry table might not exist:', e.message);
        }

    } catch (err) {
        console.error('Error connecting:', err.message);
    } finally {
        await sequelize.close();
    }
}

inspect();
