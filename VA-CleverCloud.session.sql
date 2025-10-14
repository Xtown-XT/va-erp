SELECT 
    empid,
    LENGTH(empid) AS empid_length,
    CHAR_LENGTH(empid) AS empid_char_length
FROM 
    employeeList;
