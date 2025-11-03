// import bcrypt from "bcryptjs";
// import User from "../modules/user/user.model.js";

// export async function seedAdminUser() {
//   try {
//     const count = await User.count();
//     if (count === 0) {
//       const hashedPassword = await bcrypt.hash(
//         process.env.ADMIN_PASSWORD || "admin123",
//         10
//       );

//       await User.create({
//         username: "xtown",
//         password: hashedPassword,
//         role: "admin",
//         createdBy: "system",
//       });

//     } else {
//     }
//   } catch (err) {
//     console.error("❌ Error seeding admin user:", err);
//   }
// }

// src/shared/seedAdmin.js
import bcrypt from "bcryptjs";
import User from "../modules/user/user.model.js";

export async function seedAdminUser() {
  try {
    console.log("🌱 Checking admin user...");
    
    const testPassword = process.env.ADMIN_PASSWORD || "admin123";
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    // Use findOrCreate to safely handle concurrent access and avoid index errors
    const [adminUser, created] = await User.findOrCreate({
      where: { username: "xtown" },
      defaults: {
        username: "xtown",
        password: hashedPassword,
        role: "admin",
        createdBy: "system",
      },
    });
    
    if (created) {
      console.log("✅ Admin user created successfully!");
      console.log("📋 Login credentials:");
      console.log("   Username: xtown");
      console.log("   Password:", testPassword);
      console.log("   User ID:", adminUser.id);
    } else {
      console.log("✅ Admin user 'xtown' already exists");
      console.log("   User ID:", adminUser.id);
      console.log("   Role:", adminUser.role);
      
      // Verify and update password if needed
      const isValid = await bcrypt.compare(testPassword, adminUser.password);
      
      if (!isValid) {
        console.log("⚠️  Password mismatch detected. Resetting...");
        await adminUser.update({ password: hashedPassword });
        console.log("✅ Password reset successfully!");
      } else {
        console.log("✅ Password is valid");
      }
      
      console.log("📋 Login with:");
      console.log("   Username: xtown");
      console.log("   Password:", testPassword);
    }
  } catch (err) {
    // Handle unique constraint errors gracefully
    if (err.name === 'SequelizeUniqueConstraintError' || err.name === 'SequelizeDatabaseError') {
      console.log("⚠️  User 'xtown' may already exist. Skipping creation.");
      
      // Try to find existing user
      try {
        const existingUser = await User.findOne({ where: { username: "xtown" } });
        if (existingUser) {
          console.log("✅ Found existing admin user 'xtown'");
        }
      } catch (findErr) {
        console.error("❌ Error finding user:", findErr.message);
      }
    } else {
      console.error("❌ Error seeding admin user:", err.message);
      console.error("Stack trace:", err.stack);
    }
  }
}
