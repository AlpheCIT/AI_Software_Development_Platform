#!/usr/bin/env python3

# Debug import issues
print("Starting import test...")

try:
    import sample_data as sd_module
    print("Module imported successfully")
    print(f"Module attributes: {dir(sd_module)}")
    
    if hasattr(sd_module, 'sample_data'):
        print("sample_data attribute found")
        print(f"sample_data type: {type(sd_module.sample_data)}")
    else:
        print("sample_data attribute NOT found")
        
    if hasattr(sd_module, 'SampleDataProvider'):
        print("SampleDataProvider class found")
        # Try creating instance manually
        provider = sd_module.SampleDataProvider()
        print(f"Created instance: {type(provider)}")
    else:
        print("SampleDataProvider class NOT found")
        
except ImportError as e:
    print(f"Import error: {e}")
except Exception as e:
    print(f"Other error: {e}")
