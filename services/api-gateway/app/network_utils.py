import ipaddress
import os
from typing import List


def get_trusted_networks() -> List[ipaddress.IPv4Network]:
    """
    Parse TRUSTED_NETWORKS environment variable into list of IPv4Network objects
    Default: Common private network ranges
    """
    default_networks = [
        "192.168.0.0/16",    # Common home networks
        "10.0.0.0/8",        # Private network
        "172.16.0.0/12",     # Private network
        "127.0.0.0/8",       # Localhost
    ]
    
    networks_str = os.getenv("TRUSTED_NETWORKS", ",".join(default_networks))
    networks = []
    
    for network_str in networks_str.split(","):
        network_str = network_str.strip()
        if network_str:
            try:
                networks.append(ipaddress.IPv4Network(network_str, strict=False))
            except Exception as e:
                print(f"Warning: Invalid network '{network_str}': {e}")
    
    return networks


def is_trusted_network(client_ip: str) -> bool:
    """
    Check if client IP is in a trusted network
    """
    if not client_ip:
        return False
    
    try:
        # Parse client IP
        ip = ipaddress.IPv4Address(client_ip)
        
        # Check against trusted networks
        trusted_networks = get_trusted_networks()
        
        for network in trusted_networks:
            if ip in network:
                return True
        
        return False
    except Exception as e:
        print(f"Error checking trusted network for {client_ip}: {e}")
        return False


def get_client_ip(request) -> str:
    """
    Extract client IP from request, handling proxies
    """
    # Check X-Forwarded-For header (if behind nginx/proxy)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Get first IP in the chain
        return forwarded_for.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Fall back to direct client host
    if request.client:
        return request.client.host
    
    return "unknown"