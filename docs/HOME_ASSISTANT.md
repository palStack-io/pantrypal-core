# Home Assistant

pantryPal exposes a REST API that Home Assistant can read and write with an API key.


## Quick Setup

Add this to your `configuration.yaml`:

```yaml
sensor:
  - platform: rest
    name: Pantry Expiring Items
    resource: http://YOUR_SERVER:8888/api/stats/expiring?days=7
    headers:
      X-API-Key: YOUR_API_KEY_HERE
    value_template: "{{ value_json.summary.total_expiring }}"
    json_attributes:
      - summary
      - items
    scan_interval: 3600
```

## Generate API Key

1. Sign in to pantryPal web interface
2. Go to Settings
3. Scroll to "API Keys" section
4. Click "Generate New API Key"
5. Give it a name (e.g., "Home Assistant")
6. Copy the key and use it in your Home Assistant configuration

## Example Automation

```yaml
automation:
  - alias: "Morning Pantry Check"
    trigger:
      - platform: time
        at: "09:00:00"
    condition:
      - condition: numeric_state
        entity_id: sensor.pantry_expiring_items
        above: 0
    action:
      - service: notify.mobile_app
        data:
          title: "Pantry Alert"
          message: "{{ states('sensor.pantry_expiring_items') }} items expiring soon"
```

---
