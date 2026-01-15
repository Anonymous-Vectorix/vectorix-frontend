# vectorix-frontend

# Installation Guide 🔥
## ✅ Hosting Requirements

<details>
<summary>Click To Expand</summary>

* [Node.js](https://nodejs.org) Version 22.18 Or Higher, I Recommend the STABLE Version To Get Rid Of Any Errors.
* A VPS would be advised, so you don't need to keep your PC/laptop/RasPi 24/7 online! 
* If You Have A VPS Then See This [VPS Ubuntu Setup Guide](https://github.com/Anonymous-Vectorix/vectorix-frontend/#-vps-ubuntu-setup-guide) 

</details>

# 🌟 Startup And Errors

<details>
<summary>Click To Expand</summary>

1. Package Installation 
    * Type The Following In Your Console Or Terminal To Install The Required Packages
    ```
    npm i
    ```
    After The Packages Are Installed Ignore The red and yellow errors instead of `npmERR` Errors. 
    If You Are Getting This Kind Of Errors Then You Need to read And Understand What Is The Error Like If Any File Is Missing Or Something Like That.

    * Now, Type The Following In The Console To run the code in development phase
    ```
    npm run dev
    ```
    * Use this command for Production phase
    ```
    npm run build
    ```
    * Finally, To Serve the website to a domain
    ```
    npm run preview -- --host [ip] --port [port]
    ```
    **Note**:- You Can Also Type `npm run dev` To Run the Website
   ### You Are Good To Go Now! ✈️

   # 🚀 VPS-Ubuntu-Setup-Guide
<details>
<summary>Click To Expand</summary>

1. Node.js Installation
    * Step 1 – Update the APT index
    ```
    sudo apt update -y  
    ```

    ```
    sudo apt clean all
    ```

2. Install Node.js from the repository
    * Execute the commands below as root user.
    ```
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
    ```    

    * Once the Node.js repository is configured, install Node.js by executing the commands below:
    ```
    apt install -y nodejs vim
    ```

3. Verifing Node.js installation

    * To verify Node.js version:
    ```
    node -v
    ```
    Expected result: 
    ```
    v22.16.0
    ```

    If You Get The Result Something Like This then You Are Good To Go. If NOT Then You Might Not Have upgraded The ubuntu version.

4. Installing pm2 (Process Manager) 
    pm2 Is a Process Manager Which Keeps The Bot On Even IF You Close The Console.

    * To Install pm2:
    ```
    npm i pm2 -g
    ```
