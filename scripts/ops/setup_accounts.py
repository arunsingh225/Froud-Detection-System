"""Create your own Admin and User accounts on a fresh stack, then deactivate the documented demo users.

Prerequisite: the stack was started once with SEED_DEMO_DATA=true (that creates the demo admin used to bootstrap).

    python scripts/ops/setup_accounts.py --admin-email admin@example.com --user-email user@example.com

Passwords are asked for on the terminal (hidden), or taken from FG_ADMIN_PASSWORD / FG_USER_PASSWORD.
Minimum password length is 8. Demo users are deactivated, not deleted (reversible by an admin).
"""
import argparse
import getpass
import json
import os
import urllib.error
import urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("--api", default="http://localhost:5000")
ap.add_argument("--admin-email", required=True)
ap.add_argument("--admin-name", default="Administrator")
ap.add_argument("--admin-phone", default=None, help="optional, enables phone (SMS code) sign-in for the admin")
ap.add_argument("--user-email", required=True)
ap.add_argument("--user-name", default="Investigator")
ap.add_argument("--user-phone", default=None)
ap.add_argument("--keep-demo", action="store_true", help="do not deactivate the demo users")
a = ap.parse_args()

admin_pw = os.environ.get("FG_ADMIN_PASSWORD") or getpass.getpass("Admin password (min 8 chars): ")
user_pw = os.environ.get("FG_USER_PASSWORD") or getpass.getpass("User password (min 8 chars): ")
H = {"Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest"}
DEMO_ADMIN = ("priyanka.iyer@fraudguard.enterprise.io", "password123")


def call(method, path, body=None, cookie=None):
    h = dict(H)
    if cookie:
        h["Cookie"] = cookie          # sent by hand: the auth cookie is Secure and we talk plain http to localhost
    req = urllib.request.Request(a.api + "/api" + path, method=method, headers=h,
                                 data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        return r, (json.loads(raw) if raw else None)


def login(email, pw):
    r, _ = call("POST", "/auth/login", {"email": email, "password": pw})
    return "; ".join(c.split(";")[0] for c in r.headers.get_all("Set-Cookie") or [])


try:
    cookie = login(*DEMO_ADMIN)
except urllib.error.HTTPError as e:
    raise SystemExit(f"Could not sign in as the demo admin (HTTP {e.code}). Start the stack once with SEED_DEMO_DATA=true on an empty database.")

for email, name, pw, role, dept, phone in ((a.admin_email, a.admin_name, admin_pw, "ADMIN", "Administration", a.admin_phone),
                                           (a.user_email, a.user_name, user_pw, "INVESTIGATOR", "Fraud Operations", a.user_phone)):
    try:
        body = {"fullName": name, "email": email, "password": pw, "role": role, "department": dept}
        if phone:
            body["phone"] = phone
        call("POST", "/users", body, cookie)
        print("created", role, email)
    except urllib.error.HTTPError as e:
        print("could not create", email, "HTTP", e.code, e.read().decode()[:160])

new_cookie = login(a.admin_email, admin_pw)          # prove the new admin works before touching the demo users
print("new admin can sign in")
if not a.keep_demo:
    _, users = call("GET", "/users", cookie=new_cookie)
    rows = users.get("data", users)
    for u in rows:
        if u["email"].endswith("@fraudguard.enterprise.io") and u.get("isActive"):
            call("PATCH", f"/users/{u['userId']}/status", {"isActive": False}, new_cookie)
            print("deactivated demo user", u["email"])
print("done")
