
# Manual Admin Seed Instruction

To manually create the Admin user (`xtown`) in your production database, run the following SQL command.

## SQL Query

```sql
INSERT INTO users (id, username, password, role, createdBy, createdAt, updatedAt)
VALUES (
    UUID(), 
    'xtown', 
    'HASH_PLACEHOLDER', 
    'admin', 
    'system', 
    NOW(), 
    NOW()
);
```

*Replace `HASH_PLACEHOLDER` with a BCrypt hash of your password.*
*Example hash for 'admin123': `$2a$10$YourGeneratedHashHere`*

### How to generate a hash?
If you have node installed:
```bash
node -e "console.log(require('bcryptjs').hashSync('admin123', 10))"
```

### Validation
Check if the user exists:
```sql
SELECT * FROM users WHERE username = 'xtown';
```
