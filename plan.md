# System Configuration Setup Plan

## 1. Database Setup

```sql
-- Create simple configuration table with updated schema
CREATE TABLE system_config (
    id SERIAL PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to automatically update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial configuration with updated structure
INSERT INTO system_config (value) VALUES
(
    '{
        "businessType": "dental clinic",
        "businessName": "Smile Dental Care",
        "businessSummary": "A modern dental practice providing comprehensive dental care with a focus on patient comfort and advanced technology.",
        "businessHours": {
            "start": "9:00 AM",
            "end": "5:00 PM"
        },
        "serviceDuration": "60 minutes",
        "advanceBookingMonths": 3
    }'::jsonb
);

-- Verify trigger is working
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'system_config';
```

## 2. Frontend Setup

### Create Configuration Admin Page
```
public/
 ├── config.html        # Configuration management page and js and its styles in  file
    
   
```

### Implementation Steps:
1. Create simple form interface with fields:
   - Business Type
   - Business Name
   - Operating Hours
   - Service Duration
   - Phone Format Settings
   - Advance Booking Months

2. Add basic functionality:
   - Load current configuration
   - Update configuration
   - Show success/error messages
   - Basic validation

3. Style requirements:
   - Responsive design
   - Clear form layout
   - Validation feedback
   - Loading states

