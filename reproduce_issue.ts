import { exec } from "child_process";
import fs from "fs";
import { promisify } from "util";

const execPromise = promisify(exec);

async function reproduce() {
  console.log("🚀 Testing Python generation...");

  // Mock data
  const code = `
def solution(nums):
    return sum(nums)
`;
  // Input that triggers the fallback logic (and thus the print failure path potentially)
  const runInput = `invalid_input`;
  const functionName = "solution";
  const args = ["nums"];
  const jsonArgs = JSON.stringify(args);

  // The logic from route.ts (FIXED VERSION)
  const pythonScript = `
import json
import sys

${code}

try:
    l = {}
    g = globals().copy()
    
    # 1. Try statement
    try:
        exec("""${runInput.replace(/"/g, '\\"')}""", g, l)
    except:
        pass

    func_args = []
    arg_names = ${jsonArgs}
    
    parse_success = False
    
    # 3b. Multiple Args (splitlines)
    if not parse_success and len(arg_names) > 1:
        try:
            input_str = """${runInput.replace(/"/g, '\\"')}"""
            lines = [line.strip() for line in input_str.splitlines() if line.strip()]
            if len(lines) == len(arg_names):
                # This block would normally assign args, but we're forcing failure
                pass
        except:
            pass
    
    // ... parsing logic (skipped checks for brevity since we want to hit the else block)
    // forcing failure to reach the print statements
    
    if parse_success:
        pass
    else:
        print("Error: Could not parse arguments from custom input.")
        # This line was causing SyntaxError:
        print("\\nPlease ensure your input matches one of these formats:")
        print("1. Variable assignments")

except Exception as e:
    print(f"Runtime Error: {e}")
`;

  fs.writeFileSync("reproduce_syntax.py", pythonScript);

  try {
    const { stdout, stderr } = await execPromise("python reproduce_syntax.py");
    console.log("Output:");
    console.log(stdout);
    if (stderr) console.error("Stderr:", stderr);
  } catch (e) {
    console.error("Execution failed:", e);
  }
}

reproduce();
