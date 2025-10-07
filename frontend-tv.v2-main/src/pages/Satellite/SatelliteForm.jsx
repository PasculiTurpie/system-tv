// src/pages/Satellite/SatelliteForm.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import api from "../../utils/api";
import "../../components/styles/theme.css";
import "../../components/styles/forms.css";
import "../../components/styles/tables.css";


const SatelliteSchema = Yup.object().shape({
    satelliteName: Yup.string().required("Campo obligatorio"),
    satelliteUrl: Yup.string()
        .test(
            "starts-with-http",
            "La URL debe comenzar con http:// o https://",
            (value) => value?.startsWith("http://") || value?.startsWith("https://")
        )
        .url("Debe ser una URL válida")
        .required("La URL es obligatoria"),
    satelliteType: Yup.string()
        .notOneOf(["0", "default", ""], "Debes seleccionar una opción válida.")
        .required("Campo obligatorio"),
});

const SatelliteForm = () => {
    const [polarizations, setPolarizations] = useState([]);
    const [tipoMap, setTipoMap] = useState({}); // { 'satelite': ObjectId, ... }
    const [loadingTipos, setLoadingTipos] = useState(false);
    const nameInputRef = useRef(null);

    // Cargar polarizaciones
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const resp = await api.getPolarizations();
                const arr = resp?.data ?? resp ?? [];
                if (mounted) setPolarizations(Array.isArray(arr) ? arr : []);
            } catch (error) {
                console.error("Error fetching polarization data:", error);
                if (mounted) setPolarizations([]);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Cargar/Mapear TipoEquipo
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoadingTipos(true);
                const res = await api.getTipoEquipo();
                const arr = res?.data || [];
                const map = {};
                for (const t of arr) {
                    if (t?.tipoNombre && t?._id) {
                        map[String(t.tipoNombre).toLowerCase()] = t._id;
                    }
                }
                if (mounted) setTipoMap(map);
            } catch (err) {
                console.warn("No se pudo cargar TipoEquipo:", err?.response?.data || err);
            } finally {
                if (mounted) setLoadingTipos(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Asegura que exista el tipo 'satelite'
    const ensureTipoId = async (name = "satelite") => {
        const key = String(name).toLowerCase();
        if (tipoMap[key]) return tipoMap[key];
        try {
            const created = await api.createTipoEquipo({ tipoNombre: name });
            const id = created?._id;
            if (id) {
                setTipoMap((prev) => ({ ...prev, [key]: id }));
                return id;
            }
        } catch (error) {
            console.warn("No se pudo crear TipoEquipo 'satelite'", error);
            try {
                const res = await api.getTipoEquipo();
                const arr = res?.data || [];
                const found = arr.find(
                    (t) => String(t?.tipoNombre).toLowerCase() === key
                );
                if (found?._id) {
                    setTipoMap((prev) => ({ ...prev, [key]: found._id }));
                    return found._id;
                }
            } catch (refreshError) {
                console.warn("No se pudo refrescar TipoEquipo tras error", refreshError);
            }
            throw new Error("No existe ni se pudo crear el TipoEquipo 'satelite'.");
        }
    };

    return (
        <div className="outlet-main">
            <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link to="/listar-satelite">Listar</Link></li>
                    <li className="breadcrumb-item active" aria-current="page">Formulario</li>
                </ol>
            </nav>

            <Formik
                initialValues={{
                    satelliteName: "",
                    satelliteUrl: "",
                    satelliteType: "",
                }}
                validationSchema={SatelliteSchema}
                enableReinitialize
                onSubmit={async (values, { resetForm }) => {
                    if (loadingTipos) {
                        Swal.fire({
                            icon: "info",
                            title: "Cargando tipos de equipo…",
                            text: "Espera un momento e intenta nuevamente.",
                        });
                        return;
                    }
                    try {
                        // 1) Crear Satélite (usa 'satelliteName' correcto)
                        const sat = await api.createSatelite({
                            satelliteName: values.satelliteName,
                            satelliteUrl: values.satelliteUrl,
                            satelliteType: values.satelliteType, // ObjectId Polarization
                        });
                        const satId = sat?._id;

                        // 2) Conseguir ObjectId del tipo 'satelite'
                        const tipoSatId = await ensureTipoId("satelite");

                        // 3) Crear Equipo asociado con referencia al satélite
                        let equipoOk = true;
                        let equipoMsg = "";
                        try {
                            await api.createEquipo({
                                nombre: values.satelliteName,
                                marca: "SAT",
                                modelo: "GENERIC",
                                tipoNombre: tipoSatId,
                                satelliteRef: satId,      // ← guarda la referencia
                            });
                            equipoMsg = "Equipo creado correctamente.";
                        } catch (bgErr) {
                            equipoOk = false;
                            equipoMsg =
                                bgErr?.response?.data?.message ||
                                "No se pudo crear Equipo desde Satélite.";
                            console.warn("No se pudo crear Equipo (satelite):", bgErr?.response?.data || bgErr);
                        }

                        // 4) Nombre de la polarización para el resumen
                        const list = (polarizations?.data ?? polarizations ?? []);
                        const selectedPolarization = list.find((p) => p._id === values.satelliteType);
                        const polarizationName = selectedPolarization?.typePolarization || "Desconocido";

                        // 5) Feedback + reset
                        Swal.fire({
                            title: "Satélite guardado",
                            icon: "success",
                            html: `
                <div style="text-align:left">
                  <div><b>Nombre:</b> ${values.satelliteName}</div>
                  <div><b>URL:</b> ${values.satelliteUrl}</div>
                  <div><b>Polarización:</b> ${polarizationName}</div>
                  <hr/>
                  <div><b>Equipo:</b> ${equipoOk ? "Creado" : "No creado"}</div>
                  <div style="color:${equipoOk ? "#065f46" : "#991b1b"}">${equipoMsg}</div>
                </div>
              `,
                        }).then(() => {
                            resetForm();
                            nameInputRef.current?.focus();
                        });
                    } catch (error) {
                        Swal.fire({
                            title: "Error",
                            icon: "error",
                            text: `No se pudo crear el satélite`,
                            footer: `${error?.response?.data?.message || error.message}`,
                        });
                    }
                }}
            >
                {({ errors, touched }) => (
                    <Form className="form__add">
                        <h1 className="form__titulo">Ingresa un satélite</h1>

                        <div className="form__group">
                            <label htmlFor="satelliteName" className="form__group-label">
                                Nombre de Satélite
                                <br />
                                <Field
                                    innerRef={nameInputRef}
                                    type="text"
                                    className="form__group-input"
                                    placeholder="Nombre"
                                    name="satelliteName"
                                />
                            </label>
                            {errors.satelliteName && touched.satelliteName && (
                                <div className="form__group-error">{errors.satelliteName}</div>
                            )}
                        </div>

                        <div className="form__group">
                            <label htmlFor="satelliteUrl" className="form__group-label">
                                Url web
                                <br />
                                <Field
                                    type="text"
                                    className="form__group-input"
                                    placeholder="https://…"
                                    name="satelliteUrl"
                                />
                            </label>
                            {errors.satelliteUrl && touched.satelliteUrl && (
                                <div className="form__group-error">{errors.satelliteUrl}</div>
                            )}
                        </div>

                        <div className="form__group">
                            <label htmlFor="satelliteType" className="form__group-label">
                                Selecciona la polaridad
                                <br />
                                <Field as="select" className="form__group-input" name="satelliteType">
                                    <option value={"0"}>--Seleccionar--</option>
                                    {(polarizations?.data ?? polarizations ?? []).map((p) => (
                                        <option key={p._id} value={p._id}>
                                            {p.typePolarization}
                                        </option>
                                    ))}
                                </Field>
                            </label>
                            {errors.satelliteType && touched.satelliteType && (
                                <div className="form__group-error">{errors.satelliteType}</div>
                            )}
                        </div>

                        <button type="submit" className="button btn-primary">Enviar</button>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default SatelliteForm;