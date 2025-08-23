#How to Use the Script
#1. Print all filenames and paths to the console, bypassing excludes:
    #python list_files.py --print --all  
 
#2. Write all filenames and paths to a file, bypassing excludes:
    #python list_files.py --file-only --all  
 
#3. Write all filenames, paths, and their contents to a file, bypassing excludes:
    #python list_files.py --all  
 
#4. Print filenames and paths to the console with excludes:
    #python list_files.py --print  
 
#5. Write filenames and paths to a file with excludes:
    #python list_files.py --file-only  
 
#6. Write filenames, paths, and their contents to a file with excludes:
    #python list_files.py  

#7. Print all filenames and paths to the console from the current directory:
    #python list_files.py --print --current-dir  
 
#8. Write all filenames and paths to a file from the current directory:
    #python list_files.py --file-only --current-dir  

#9. Write all filenames, paths, and their contents to a file from the current directory:
    #python list_files.py --current-dir  

import os  
import datetime  
import fnmatch  
import argparse  
  
# Define the directories to include and exclude  
include_dirs = ['apps', 'config', 'infrastructure', 'package_files', 'sample-project', 'scripts', 'services', 'src']  # 'Invoices2-server', 'invoices2-app'  
exclude_dirs = [  
    'common', 'README_DOCS','node_modules', 'Ideas', '.angular', '.next', '.husky', '.github', '.git', 'dist', 'tmp', '.nx', 'libs', 'styles',   
    '.eslin*', '__pycache__', 'terraform', '*.github*', 'assets', 'Chat_History', 'public', '.nuxt', 'out', '.cache',   
    '.vuepress/dist', '.temp', '.docusaurus', '.serverless', '.fusebox', '.dynamodb', '.vscode'  
]  
exclude_files = [  
    '*.md', 'analyzer-legacy','.env','index-D7J2NUy_.js', 'package-lock.json', 'package.json', '*.svg', '*.ico', '*.lock', '*.jpg', '*.txt','*.github*',   
    '*.git*', 'LICENSE', '*.png', 'setup-database.js', 'setup-database.py', 'setup-runner.js', 'README.md', '*.log',   
    'npm-debug.log', 'yarn-error.log', '.pnpm-debug.log', '.grunt', 'bower_components', '.env.local',   
    '.env.development.local', '.env.test.local', '.env.production.local', '.nyc_output', 'coverage', 'lib-cov',   
    'logs', 'report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json', 'typings', '.npm', '.eslintcache', '.rpt2_cache',   
    '.rts2_cache_cjs', '.rts2_cache_es', '.rts2_cache_umd', '.node_repl_history', '*.tgz', '.yarn-integrity'  
]  
backup_dir = "_backup"  
  
# Function to get the current date and time in a specific format  
def get_timestamp_filename():  
    now = datetime.datetime.now()  
    timestamp = now.strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Format to include milliseconds  
    return f"files_list_{timestamp}.txt"  
  
def gather_files(directory, exclude_dirs, exclude_files):  
    file_paths = []  
    for root, dirs, files in os.walk(directory):  
        print(f"Scanning directory: {root}")  
        dirs[:] = [d for d in dirs if d not in exclude_dirs]  
        for file in files:  
            if not any(fnmatch.fnmatch(file, pattern) for pattern in exclude_files):  
                full_path = os.path.join(root, file)  
                print(f"Found file: {full_path}")  
                file_paths.append(full_path)  
    return file_paths  
  
def gather_all_files(directory):  
    file_paths = []  
    for root, dirs, files in os.walk(directory):  
        print(f"Scanning directory: {root}")  
        for file in files:  
            full_path = os.path.join(root, file)  
            print(f"Found file: {full_path}")  
            file_paths.append(full_path)  
    return file_paths  
  
def write_file_paths_to_file(file_paths, output_filename, backup_dir):  
    os.makedirs(backup_dir, exist_ok=True)  
    backup_file_path = os.path.join(backup_dir, output_filename)  
    with open(backup_file_path, 'w', encoding='utf-8') as outfile:  
        for file_path in file_paths:  
            outfile.write(f"{file_path}\n")  
    return backup_file_path  
  
def write_files_to_file(file_paths, output_filename, backup_dir):  
    os.makedirs(backup_dir, exist_ok=True)  
    backup_file_path = os.path.join(backup_dir, output_filename)  
    skipped_files = []  
    with open(backup_file_path, 'w', encoding='utf-8') as outfile:  
        for file_path in file_paths:  
            outfile.write(f"# {file_path}\n\n")  
            try:  
                with open(file_path, 'r', encoding='utf-8') as f:  
                    outfile.write(f.read())  
            except UnicodeDecodeError:  
                skipped_files.append(file_path)  
                outfile.write("Error: Unable to read file due to encoding issues.\n")  
            outfile.write("\n\n")  
    if skipped_files:  
        with open(os.path.join(backup_dir, "skipped_files.txt"), 'w', encoding='utf-8') as skipped_file:  
            for file_path in skipped_files:  
                skipped_file.write(f"{file_path}\n")  
    return backup_file_path  
  
def print_files(file_paths):  
    for file_path in file_paths:  
        print(file_path)  
  
def main():  
    parser = argparse.ArgumentParser(description="Process some files.")  
    parser.add_argument('--print', action='store_true', help="Print file names and paths instead of writing to a file")  
    parser.add_argument('--file-only', action='store_true', help="Write only file names and paths to a file")  
    parser.add_argument('--all', action='store_true', help="Include all files and directories, bypassing excludes")  
    parser.add_argument('--current-dir', action='store_true', help="List all files and folders from the current directory")  
    args = parser.parse_args()  
  
    all_file_paths = []  
    if args.current_dir:  
        print("Gathering files from current directory...")  
        all_file_paths.extend(gather_all_files('.'))  
    else:  
        for directory in include_dirs:  
            if not os.path.exists(directory):  
                print(f"Directory does not exist: {directory}")  
                continue  
            print(f"Gathering files from directory: {directory}")  
            if args.all:  
                all_file_paths.extend(gather_all_files(directory))  
            else:  
                all_file_paths.extend(gather_files(directory, exclude_dirs, exclude_files))  
  
    print(f"Total files gathered: {len(all_file_paths)}")  
  
    if not any(vars(args).values()):  # Check if no arguments are provided  
        print("No arguments provided, defaulting to writing files and their contents.")  
        output_filename = get_timestamp_filename()  
        backup_file_path = write_files_to_file(all_file_paths, output_filename, backup_dir)  
        print(f"File list and contents written to {backup_file_path}")  
    elif args.print:  
        print("Printing file paths...")  
        print_files(all_file_paths)  
    else:  
        output_filename = get_timestamp_filename()  
        if args.file_only:  
            print("Writing file paths to file...")  
            backup_file_path = write_file_paths_to_file(all_file_paths, output_filename, backup_dir)  
            print(f"File paths written to {backup_file_path}")  
        else:  
            print("Writing file paths and their contents to file...")  
            backup_file_path = write_files_to_file(all_file_paths, output_filename, backup_dir)  
            print(f"File list and contents written to {backup_file_path}")  
  
if __name__ == "__main__":  
    main()  